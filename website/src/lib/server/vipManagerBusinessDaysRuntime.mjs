/**
 * Executable business-day route contract with injected authentication and data
 * adapters. The Next route supplies the remote Supabase adapter; tests supply a
 * local deterministic adapter without changing HTTP semantics.
 */
export async function executeVipManagerBusinessDaysRequest(request, dependencies) {
  const auth = await dependencies.authorize(request);
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== "owner") {
    return jsonResult(403, { ok: false, error: "FORBIDDEN" });
  }

  try {
    const url = new URL(request.url);
    if (
      [...url.searchParams.keys()].some(
        (key) => key !== "afterBusinessDate" && key !== "limit",
      )
      || url.searchParams.getAll("afterBusinessDate").length !== 1
      || url.searchParams.getAll("limit").length !== 1
    ) {
      return jsonResult(400, { ok: false, error: "INVALID_COMMAND", field: "afterBusinessDate" });
    }

    const afterBusinessDate = dependencies.readBusinessDate(
      url.searchParams.get("afterBusinessDate"),
    );
    const limit = Number(url.searchParams.get("limit"));
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > dependencies.maximumSuggestions) {
      return jsonResult(400, { ok: false, error: "INVALID_COMMAND", field: "limit" });
    }

    const rows = await dependencies.listBusinessDays(afterBusinessDate, limit);
    const businessDates = [...new Set(rows.map((row) => dependencies.readBusinessDate(row.business_date)))]
      .filter((date) => date > afterBusinessDate)
      .sort((left, right) => left.localeCompare(right))
      .slice(0, limit);

    return jsonResult(200, { ok: true, businessDates });
  } catch (error) {
    if (dependencies.isContractError(error)) {
      return jsonResult(400, { ok: false, error: "INVALID_COMMAND", field: error.field });
    }
    return jsonResult(500, { ok: false, error: "vip_floor_business_days_read_failed" });
  }
}

function jsonResult(status, body) {
  return {
    status,
    body,
    headers: { "Cache-Control": "no-store" },
  };
}
