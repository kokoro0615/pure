import { describe, expect, it } from "vitest";

import { readPureEnvironment, readPureProfile } from "@/lib/server/pureRuntime";
import { readPureSupabaseConfiguration } from "@/lib/server/supabaseAdmin";
import {
  ticketRevisionAllowsNewSale,
  ticketRevisionIsReady,
} from "@/lib/server/tickets/ticketRevisionReadiness";

const secret = "sb_secret_" + "x".repeat(40);
const event = { eventId: "event", businessDate: "2026-10-10" };

describe("a hosted deployment never falls back to the local mock", () => {
  it("requires an explicit profile on Vercel", () => {
    expect(() => readPureProfile({ VERCEL_ENV: "preview" })).toThrow("pure_profile_missing");
    expect(() => readPureProfile({ VERCEL_ENV: "preview", PURE_PROFILE: "local-mock" })).toThrow(
      "pure_profile_local_mock_hosted",
    );
  });

  it("requires the production profile on the production target", () => {
    expect(() => readPureProfile({ VERCEL_ENV: "production", PURE_PROFILE: "pure-dev" })).toThrow(
      "pure_profile_production_required",
    );
    expect(readPureProfile({ VERCEL_ENV: "production", PURE_PROFILE: "production" })).toBe("production");
    expect(() =>
      readPureEnvironment({ VERCEL_ENV: "production", PURE_PROFILE: "production", PURE_ENVIRONMENT: "test" }),
    ).toThrow("pure_environment_conflict");
  });

  it("keeps the unhosted local default", () => {
    expect(readPureProfile({})).toBe("local-mock");
  });
});

describe("each profile binds only its own database project", () => {
  it("never lets production reach the development project", () => {
    expect(() =>
      readPureSupabaseConfiguration({
        PURE_PROFILE: "production",
        SUPABASE_URL: "https://airgkuioqioknxuqpciq.supabase.co",
        SUPABASE_SECRET_KEY: secret,
      }),
    ).toThrow(/pure_supabase_(production_unconfigured|project_mismatch)/u);
  });

  it("binds production to the production project only", () => {
    expect(
      readPureSupabaseConfiguration({
        PURE_PROFILE: "production",
        SUPABASE_URL: "https://jogflpfqtlywhyawgbgb.supabase.co",
        SUPABASE_SECRET_KEY: secret,
      }).url,
    ).toBe("https://jogflpfqtlywhyawgbgb.supabase.co");
    expect(() =>
      readPureSupabaseConfiguration({
        PURE_PROFILE: "pure-dev",
        SUPABASE_URL: "https://jogflpfqtlywhyawgbgb.supabase.co",
        SUPABASE_SECRET_KEY: secret,
      }),
    ).toThrow("pure_supabase_project_mismatch");
  });

  it("keeps the development binding for pure-dev", () => {
    expect(
      readPureSupabaseConfiguration({
        PURE_PROFILE: "pure-dev",
        SUPABASE_URL: "https://airgkuioqioknxuqpciq.supabase.co",
        SUPABASE_SECRET_KEY: secret,
      }).url,
    ).toBe("https://airgkuioqioknxuqpciq.supabase.co");
  });
});

describe("production ticket sales need the owner's release approval", () => {
  it("is closed without approval and open with it", () => {
    const closed = { PURE_PROFILE: "production" };
    const approved = { PURE_PROFILE: "production", PURE_TICKET_SALES_RELEASE_APPROVED: "true" };
    expect(ticketRevisionIsReady("A", closed)).toBe(false);
    expect(ticketRevisionAllowsNewSale(event, closed)).toBe(false);
    expect(ticketRevisionIsReady("A", approved)).toBe(true);
    expect(ticketRevisionAllowsNewSale(event, approved)).toBe(true);
  });

  it("stays ready for local and development profiles", () => {
    expect(ticketRevisionAllowsNewSale(event, { PURE_PROFILE: "local-mock" })).toBe(true);
    expect(ticketRevisionAllowsNewSale(event, { PURE_PROFILE: "pure-dev" })).toBe(true);
  });
});
