// Large enough for a club group booking while keeping a single static-inventory
// checkout from reserving an operationally risky share of one night's entry.
export const MAX_TICKETS_PER_ORDER = 20;

export type TicketCartItem = {
  readonly ticketTypeId: string;
  readonly quantity: number;
};

export type TicketCartParseResult =
  | {
      readonly ok: true;
      readonly items: readonly TicketCartItem[];
      readonly totalQuantity: number;
    }
  | {
      readonly ok: false;
      readonly error: "cart_empty" | "invalid_ticket_item" | "invalid_ticket_quantity" | "too_many_tickets";
    };

export function normalizeTicketCartItems(
  rawItems: unknown,
  legacyTicketTypeId?: unknown,
  legacyQuantity?: unknown,
): TicketCartParseResult {
  if (rawItems !== undefined && !Array.isArray(rawItems)) {
    return { ok: false, error: "invalid_ticket_item" };
  }

  const candidates = Array.isArray(rawItems)
    ? rawItems
    : typeof legacyTicketTypeId === "string" && legacyTicketTypeId.trim()
      ? [
          {
            ticketTypeId: legacyTicketTypeId,
            quantity: legacyQuantity === undefined ? 1 : legacyQuantity,
          },
        ]
      : [];

  if (candidates.length === 0) {
    return { ok: false, error: "cart_empty" };
  }

  const quantitiesByTicket = new Map<string, number>();

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      return { ok: false, error: "invalid_ticket_item" };
    }

    const record = candidate as Record<string, unknown>;
    const ticketTypeId = typeof record.ticketTypeId === "string" ? record.ticketTypeId.trim() : "";
    const quantity = parsePositiveInteger(record.quantity);

    if (!ticketTypeId) {
      return { ok: false, error: "invalid_ticket_item" };
    }
    if (quantity === null) {
      return { ok: false, error: "invalid_ticket_quantity" };
    }

    quantitiesByTicket.set(ticketTypeId, (quantitiesByTicket.get(ticketTypeId) ?? 0) + quantity);
  }

  const items = Array.from(quantitiesByTicket, ([ticketTypeId, quantity]) => ({
    ticketTypeId,
    quantity,
  }));
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  if (
    totalQuantity > MAX_TICKETS_PER_ORDER ||
    items.some((item) => item.quantity > MAX_TICKETS_PER_ORDER)
  ) {
    return { ok: false, error: "too_many_tickets" };
  }

  return { ok: true, items, totalQuantity };
}

export function serializeTicketCartItems(items: readonly TicketCartItem[]) {
  return items.map((item) => `${item.ticketTypeId}:${item.quantity}`).join(",");
}

export function parseSerializedTicketCartItems(value: string): TicketCartParseResult {
  if (!value) {
    return { ok: false, error: "cart_empty" };
  }

  return normalizeTicketCartItems(
    value.split(",").map((entry) => {
      const separatorIndex = entry.lastIndexOf(":");
      if (separatorIndex <= 0) return null;
      return {
        ticketTypeId: entry.slice(0, separatorIndex),
        quantity: entry.slice(separatorIndex + 1),
      };
    }),
  );
}

function parsePositiveInteger(value: unknown) {
  const quantity = typeof value === "number" ? value : Number(value);
  return Number.isInteger(quantity) && quantity >= 1 ? quantity : null;
}
