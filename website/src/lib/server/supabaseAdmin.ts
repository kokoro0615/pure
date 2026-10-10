import "server-only";

import { createPureDbClient, type PureDbClient } from "./pureDb";
import { createClient } from "@supabase/supabase-js";
import { readPureProfile } from "./pureRuntime";

/** The development project used by the `pure-dev` profile. */
export const PURE_SUPABASE_PROJECT_REF = "airgkuioqioknxuqpciq";
/**
 * The production project used by the `production` profile. Empty until the
 * owner's production project exists; an empty value keeps production closed.
 */
export const PURE_PRODUCTION_SUPABASE_PROJECT_REF = "jogflpfqtlywhyawgbgb";
let cloudClient: PureDbClient | undefined;

function expectedProjectRef(env: Readonly<Record<string, string | undefined>>) {
  return readPureProfile(env) === "production"
    ? PURE_PRODUCTION_SUPABASE_PROJECT_REF
    : PURE_SUPABASE_PROJECT_REF;
}

export function readPureSupabaseConfiguration(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SECRET_KEY?.trim();
  // This integration is deliberately bound to the customer's PURE projects,
  // one per profile: a copied GHOST URL/key, or the development project in a
  // production deployment (and vice versa), cannot silently select a database.
  const projectRef = expectedProjectRef(env);
  if (!projectRef) {
    throw new Error("pure_supabase_production_unconfigured");
  }
  if (url !== `https://${projectRef}.supabase.co`) {
    throw new Error("pure_supabase_project_mismatch");
  }
  if (!key?.startsWith("sb_secret_") || key.length < 30) {
    throw new Error("pure_supabase_secret_missing");
  }
  return { url, key };
}

/**
 * Local mock uses the dedicated Postgres adapter. Configured development uses
 * the official server-only Supabase client, with no session or cookie sharing.
 */
export function createSupabaseAdminClient(): PureDbClient {
  if (readPureProfile() === "local-mock") return createPureDbClient();
  if (!cloudClient) {
    const { url, key } = readPureSupabaseConfiguration();
    cloudClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }) as unknown as PureDbClient;
  }
  return cloudClient;
}
