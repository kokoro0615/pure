import "server-only";

const TRIAL_SUPABASE_REF = "rsvrtaavofflkvtfzsfh";
const PRODUCTION_SUPABASE_REF = "pure-local-project";
const TRIAL_RUN_ID_PATTERN = /^trial-[a-z0-9][a-z0-9-]{7,80}$/u;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/u;

export class TrialSafetyError extends Error {
  readonly code: "trial_run_id_required" | "trial_supabase_ref_rejected" | "trial_external_side_effect_blocked" | "trial_public_booking_blocked" | "trial_pii_rejected";

  constructor(code: TrialSafetyError["code"]) {
    super(code);
    this.name = "TrialSafetyError";
    this.code = code;
  }
}

export function isGhostVipTrialMode() {
  return process.env.PURE_VIP_TRIAL_MODE?.trim().toLowerCase() === "true";
}

export function getGhostVipTrialRunId() {
  if (!isGhostVipTrialMode()) return null;
  const value = process.env.PURE_VIP_TRIAL_RUN_ID?.trim() ?? "";
  if (!TRIAL_RUN_ID_PATTERN.test(value)) throw new TrialSafetyError("trial_run_id_required");
  return value;
}

export function assertTrialSupabaseUrl(url: string) {
  if (!isGhostVipTrialMode()) return;
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new TrialSafetyError("trial_supabase_ref_rejected"); }
  const hostname = parsed.hostname.toLowerCase();
  if (
    parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.port
    || (parsed.pathname !== "" && parsed.pathname !== "/")
    || parsed.search
    || parsed.hash
    || hostname === `${PRODUCTION_SUPABASE_REF}.supabase.co`
    || hostname !== `${TRIAL_SUPABASE_REF}.supabase.co`
  ) {
    throw new TrialSafetyError("trial_supabase_ref_rejected");
  }
  getGhostVipTrialRunId();
}

export function assertTrialExternalSideEffectsAllowed() {
  if (isGhostVipTrialMode()) throw new TrialSafetyError("trial_external_side_effect_blocked");
}

export function assertTrialPublicBookingAllowed() {
  if (isGhostVipTrialMode()) throw new TrialSafetyError("trial_public_booking_blocked");
}

export function normalizeTrialVipCommand(value: unknown): unknown {
  if (!isGhostVipTrialMode() || !value || typeof value !== "object" || Array.isArray(value)) return value;
  return normalizeObject(value as Record<string, unknown>, getGhostVipTrialRunId()!);
}

export function addTrialRunIdToFingerprint<T extends Record<string, unknown>>(value: T): T {
  const trialRunId = getGhostVipTrialRunId();
  return trialRunId ? { ...value, trialRunId } : value;
}

function normalizeObject(value: Record<string, unknown>, trialRunId: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([key, current]) => {
    if (current && typeof current === "object" && !Array.isArray(current)) return [key, normalizeObject(current as Record<string, unknown>, trialRunId)];
    if (Array.isArray(current)) return [key, current.map((item) => item && typeof item === "object" && !Array.isArray(item) ? normalizeObject(item as Record<string, unknown>, trialRunId) : item)];
    if (/^(displayName|guestLabel)$/u.test(key) && typeof current === "string" && current.trim()) return [key, `TRIAL ${trialRunId}`];
    if (/phone/u.test(key) && typeof current === "string") {
      if (current.trim()) throw new TrialSafetyError("trial_pii_rejected");
      return [key, null];
    }
    if (/email/u.test(key) && typeof current === "string") {
      const normalized = current.trim().toLowerCase();
      if (normalized && !normalized.endsWith("@example.com")) throw new TrialSafetyError("trial_pii_rejected");
      return [key, normalized || null];
    }
    if (/(note|memo|body)/iu.test(key) && typeof current === "string" && (EMAIL_PATTERN.test(current) || PHONE_PATTERN.test(current))) throw new TrialSafetyError("trial_pii_rejected");
    return [key, current];
  }));
}
