import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/*
 * The VIP backend release ships only what the PURE VIP Manager calls, on top of
 * the unchanged marketing site. Any added route — a public booking API, a
 * legacy admin mutation, a developer tool — must be a deliberate change here.
 */
const APP = path.resolve(__dirname, "../src/app");

function files(directory: string, name: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) return files(full, name);
    return entry === name ? [full] : [];
  });
}

const routePath = (file: string, suffix: string) =>
  path.relative(APP, file).replace(new RegExp(`/?${suffix}$`, "u"), "").replace(/^/u, "/");

describe("release surface", () => {
  it("ships exactly the VIP Manager admin API", () => {
    expect(files(path.join(APP, "api"), "route.ts").map((file) => routePath(file, "route.ts")).sort()).toEqual([
    "/api/admin/session",
    "/api/admin/session/basic-owner",
    "/api/admin/v2/customers/[customerId]",
    "/api/admin/v2/customers/[customerId]/attributes",
    "/api/admin/v2/observability/events",
    "/api/admin/v2/observability/slo",
    "/api/admin/v2/reservations",
    "/api/admin/v2/reservations/[reservationId]",
    "/api/admin/v2/reservations/[reservationId]/arrival-time",
    "/api/admin/v2/reservations/[reservationId]/assignments",
    "/api/admin/v2/reservations/[reservationId]/cancel",
    "/api/admin/v2/reservations/[reservationId]/check-in",
    "/api/admin/v2/reservations/[reservationId]/confirm",
    "/api/admin/v2/reservations/[reservationId]/customer-link",
    "/api/admin/v2/reservations/[reservationId]/extend-seat",
    "/api/admin/v2/reservations/[reservationId]/notes",
    "/api/admin/v2/reservations/[reservationId]/notifications/email",
    "/api/admin/v2/reservations/[reservationId]/schedule",
    "/api/admin/v2/reservations/[reservationId]/service-status",
    "/api/admin/v2/reservations/[reservationId]/service-status/override",
    "/api/admin/v2/staff",
    "/api/admin/v2/staff/[staffMemberId]",
    "/api/admin/v2/staff/assignments",
    "/api/admin/v2/tickets/admissions/assist",
    "/api/admin/v2/tickets/capabilities",
    "/api/admin/v2/tickets/checkout-reviews",
    "/api/admin/v2/tickets/email-jobs/retry",
    "/api/admin/v2/tickets/entry/[action]",
    "/api/admin/v2/tickets/health",
    "/api/admin/v2/tickets/orders/[orderPublicCode]",
    "/api/admin/v2/tickets/queue",
    "/api/admin/v2/tickets/refund-reviews/resolve",
    "/api/admin/v2/tickets/search",
    "/api/admin/v2/tickets/sessions/revoke",
    "/api/admin/v2/vip-blocks",
    "/api/admin/v2/vip-blocks/[blockId]",
    "/api/admin/v2/vip-blocks/series",
    "/api/admin/v2/vip-floor",
    "/api/admin/v2/vip-floor/business-days",
    "/api/admin/v2/vip-floor/options",
    "/api/admin/v2/vip-floor/revision",
    "/api/admin/v2/waitlist",
    "/api/admin/v2/waitlist/[waitlistEntryId]/call",
    "/api/admin/v2/waitlist/[waitlistEntryId]/cancel",
    "/api/admin/v2/waitlist/[waitlistEntryId]/expire",
    "/api/admin/v2/waitlist/[waitlistEntryId]/seat",
    "/api/admin/v2/walk-ins",
    "/api/admin/vip-status",
    ]);
  });

  it("keeps the marketing pages and adds none", () => {
    expect(files(APP, "page.tsx").map((file) => routePath(file, "page.tsx")).sort()).toEqual([
      "/", "/access", "/gallery", "/qa", "/rental", "/tickets", "/vip",
    ]);
  });
});
