import {
  parseArchiveReservationNoteCommand,
  parseReservationNoteCommand,
  runAdminRpcActionV2,
} from "@/lib/server/vipFloorV2Commands";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ reservationId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { reservationId } = await context.params;

  return runAdminRpcActionV2(request, {
    rpcName: "upsert_admin_reservation_note_v8",
    action: "reservation_note.upserted",
    parse: (body) => parseReservationNoteCommand(body, reservationId),
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { reservationId } = await context.params;

  return runAdminRpcActionV2(request, {
    rpcName: "archive_admin_reservation_note_v8",
    action: "reservation_note.archived",
    parse: (body) => parseArchiveReservationNoteCommand(body, reservationId),
  });
}
