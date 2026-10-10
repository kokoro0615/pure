import "server-only";

import { readPureProfile } from "../pureRuntime";

/**
 * PURE port: the source's signed release-manifest launch gate (HMAC-verified
 * "ghost.tickets.revision2.release" manifest + canary grants) is a
 * GHOST-specific production program. Pure has no launch-manifest
 * requirement; sale eligibility is governed by catalog sale windows and
 * FEATURE_TICKET_SALES_ENABLED.
 *
 * The exports below keep the ported callers' readback/monitoring surfaces
 * honest: revision constants describe the Pure schema bundle actually
 * applied and evidence alerts are empty because there is no manifest program
 * to violate.
 *
 * Readiness is the owner's explicit release decision in production: a
 * production profile sells only when PURE_TICKET_SALES_RELEASE_APPROVED is
 * "true" (on top of FEATURE_TICKET_SALES_ENABLED and the catalog windows).
 * Local and development profiles stay unconditionally ready.
 */

/** Head of the applied Pure migration bundle. */
export const TICKETS_REVISION_DB_HEAD = "0002_local_dev_capture";
/** SHA-256 of the Pure migration bundle state (see database/migrations). */
export const TICKETS_REVISION_DB_BUNDLE_SHA256 = "pure-local-bundle";
/** VIP app commit bound to this deployment — local single-repo build. */
export const TICKETS_REVISION_VIP_COMMIT = "pure-local";

export function ticketRevisionSourceCommit(
  _env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return "pure-local";
}

function releaseApproved(env: Readonly<Record<string, string | undefined>>) {
  return readPureProfile(env) !== "production"
    || env.PURE_TICKET_SALES_RELEASE_APPROVED?.trim() === "true";
}

export function ticketRevisionIsReady(
  _phase: "A" | "B",
  env: Readonly<Record<string, string | undefined>> = process.env,
  _now = Date.now(),
  _event?: { eventId: string; businessDate: string; eventSessionId?: string },
): boolean {
  return releaseApproved(env);
}

export function ticketRevisionAllowsNewSale(
  _event: { eventId: string; businessDate: string; eventSessionId?: string },
  env: Readonly<Record<string, string | undefined>> = process.env,
  _now = Date.now(),
): boolean {
  return releaseApproved(env);
}

export function ticketRevisionEvidenceAlerts(
  _env: Readonly<Record<string, string | undefined>> = process.env,
  _now = Date.now(),
): string[] {
  return [];
}
