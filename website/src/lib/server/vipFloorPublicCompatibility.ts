import "server-only";

import { packCustomerProfileValueForPostgres } from "./customerProfileCrypto";
import { isFeatureEnabled } from "./featureFlags";
import { createSupabaseAdminClient } from "./supabaseAdmin";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type VipFloorPublicCompatibilityMode = "v7" | "v8";

export type VipFloorPublicCompatibilityDecision =
  | {
      ok: true;
      mode: VipFloorPublicCompatibilityMode;
      nodeEnabled: boolean;
      databaseEnabled: boolean | null;
      alignment: "aligned" | "transition" | "unknown";
    }
  | {
      ok: false;
      error: "vip_floor_dual_write_misaligned";
      nodeEnabled: true;
      databaseEnabled: boolean | null;
      alignment: "mismatch" | "unknown";
    };

export async function resolveVipFloorPublicCompatibility(
  supabase: SupabaseAdminClient,
): Promise<VipFloorPublicCompatibilityDecision> {
  const nodeEnabled = isFeatureEnabled("FEATURE_VIP_FLOOR_DUAL_WRITE_ENABLED");
  const { data, error } = await supabase
    .from("app_settings")
    .select("value_json")
    .eq("key", "vip_floor_v2_dual_write")
    .maybeSingle();
  const databaseEnabled =
    !error && typeof data?.value_json === "boolean" ? data.value_json : null;

  if (!nodeEnabled) {
    return {
      ok: true,
      mode: "v7",
      nodeEnabled,
      databaseEnabled,
      alignment:
        databaseEnabled === false
          ? "aligned"
          : databaseEnabled === true
            ? "transition"
            : "unknown",
    };
  }

  if (databaseEnabled !== true) {
    console.error("VIP Floor public compatibility failed closed", {
      databaseSettingReadable: databaseEnabled !== null,
      deploymentEnvironment: process.env.VERCEL_ENV ?? "local",
    });
    return {
      ok: false,
      error: "vip_floor_dual_write_misaligned",
      nodeEnabled,
      databaseEnabled,
      alignment: databaseEnabled === false ? "mismatch" : "unknown",
    };
  }

  return {
    ok: true,
    mode: "v8",
    nodeEnabled,
    databaseEnabled,
    alignment: "aligned",
  };
}

export function publicAvailabilityRpcName(mode: VipFloorPublicCompatibilityMode) {
  return mode === "v8" ? "calculate_public_availability_v8" : "calculate_public_availability_v7";
}

export function publicSeatAvailabilityRpcName(mode: VipFloorPublicCompatibilityMode) {
  return mode === "v8"
    ? "calculate_public_seat_availability_v8"
    : "calculate_public_seat_availability_v7";
}

export function publicBeginHoldRpcName(mode: VipFloorPublicCompatibilityMode) {
  return mode === "v8" ? "begin_public_reservation_hold_v8" : "begin_public_reservation_hold_v7";
}

const AVAILABILITY_FIELDS = [
  "public_slot_id",
  "start_at",
  "end_at",
  "public_offering_id",
  "offering_name",
  "min_guests",
  "max_guests",
  "min_spend_yen",
  "available_resource_count",
  "is_available",
] as const;

const SEAT_AVAILABILITY_FIELDS = [
  "public_slot_id",
  "start_at",
  "end_at",
  "public_resource_code",
  "seat_name",
  "capacity_min",
  "capacity_max",
  "is_available",
  "business_date",
] as const;

export function adaptPublicAvailabilityRows(data: unknown) {
  return adaptRows(data, AVAILABILITY_FIELDS);
}

export function adaptPublicSeatAvailabilityRows(data: unknown) {
  return adaptRows(data, SEAT_AVAILABILITY_FIELDS);
}

export async function writePublicCustomerProfileBestEffort({
  customerId,
  email,
  phone,
  requestHash,
  reservationId,
  supabase,
}: {
  customerId: string | undefined;
  email: string | null;
  mode: VipFloorPublicCompatibilityMode;
  phone: string | null;
  requestHash: string;
  reservationId: string | undefined;
  supabase: SupabaseAdminClient;
}) {
  if (
    !isFeatureEnabled("FEATURE_VIP_CUSTOMER_PROFILE_WRITE_ENABLED") ||
    !customerId ||
    !reservationId
  ) {
    return;
  }

  try {
    const { data, error } = await supabase.rpc("sync_public_customer_profile_v10", {
      p_customer_id: customerId,
      p_reservation_id: reservationId,
      p_request_hash: requestHash,
      p_phone_ciphertext: packCustomerProfileValueForPostgres(phone),
      p_email_ciphertext: packCustomerProfileValueForPostgres(email),
    });

    if (error || !isAcceptedProfileResult(data)) {
      console.warn("VIP public customer profile write did not complete", {
        databaseError: Boolean(error),
      });
    }
  } catch (error) {
    console.warn("VIP public customer profile encryption/write failed", {
      code: error instanceof Error ? error.name : "unknown",
    });
  }
}

function adaptRows<const Fields extends readonly string[]>(data: unknown, fields: Fields) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => {
    const source = isRecord(row) ? row : {};
    return Object.fromEntries(fields.map((field) => [field, source[field] ?? null]));
  });
}

function isAcceptedProfileResult(value: unknown) {
  if (!isRecord(value) || typeof value.action !== "string") {
    return false;
  }

  return ["synced", "reused", "skipped"].includes(value.action);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
