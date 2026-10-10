import "server-only";

/**
 * safeErrorLog — structured server-side error logging that never emits raw
 * provider/database `error.message` strings (G-35) and always emits enough
 * correlation for a 5xx to be traced back to a stage + cause class (R-06).
 *
 * Rules enforced here:
 *  - Raw messages are never logged. Provider/PostgREST messages can contain
 *    constraint names, payload fragments, or user input.
 *  - Error identity is reduced to a safe classification: a registered internal
 *    contract code, an allowlisted `sqlState`/`type`, a documented Stripe
 *    code vocabulary entry, or the bucket `unknown_error` /
 *    `provider_code_unmapped`.
 *  - Callers pass stage/action/request correlation fields; secrets, request
 *    bodies, cookies, tokens and e-mail addresses must never be passed in.
 *    Correlation fields are additionally shape-sanitized here so unvalidated
 *    route/body params cannot reach the log line verbatim (RR-01).
 *
 * Safe identifier fields extracted from known error shapes:
 *  - PostgREST/Supabase: `code` matching SQLSTATE (`^[0-9A-Z]{5}$`) or
 *    `PGRST[0-9]{3}`, plus `status` when present.
 *  - Stripe: `type` (allowlisted stripe error class), `code`/`decline_code`
 *    only when the value is a member of the documented Stripe vocabulary
 *    (otherwise the fixed bucket `provider_code_unmapped`), `requestId`
 *    (`req_…`), `statusCode`.
 *  - Internal errors: `message`/`code` adopted as the category ONLY when the
 *    exact string is in `INTERNAL_ERROR_CATEGORIES` — the checked-in registry
 *    of snake_case contract codes actually thrown in `src/` — or a `name`
 *    matching `^[A-Z][A-Za-z]+Error$` reduced to `js_<Name>`. String shape is
 *    never treated as proof of non-secrecy.
 */

const SQL_STATE = /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/u;
const STRIPE_REQUEST_ID = /^req_[A-Za-z0-9]+$/u;
const STRIPE_TYPES = new Set([
  "StripeCardError",
  "StripeRateLimitError",
  "StripeInvalidRequestError",
  "StripeAPIError",
  "StripeConnectionError",
  "StripeAuthenticationError",
  "StripePermissionError",
  "StripeIdempotencyError",
  "StripeSignatureVerificationError",
]);
const STRIPE_DECLINE = /^[a-z_]{2,64}$/u;

/**
 * Internal error categories: the snake_case contract codes this codebase
 * actually throws (`Error(<literal>)` throw-site literals, typed-error
 * `super(<literal>)` bodies and the `code` unions of the typed Error
 * subclasses under `src/`). The drift
 * test in tests/w12-safe-error-log.test.mjs asserts every throw-site literal
 * is registered here, so adding a new contract code requires adding it to
 * this set — that is the point: membership is the review step that keeps a
 * snake_case-shaped secret from becoming an operator-visible category.
 */
export const INTERNAL_ERROR_CATEGORIES: ReadonlySet<string> = new Set([
  "account_invalid",
  "admission_challenge_expiry_invalid",
  "admission_prepare_invalid",
  "admission_qr_payload_invalid",
  "admission_readiness_invalid",
  "admission_result_invalid",
  "authority_expiry_invalid",
  "authority_id_invalid",
  "authority_token_invalid",
  "balance_import_batch_invalid",
  "balance_import_cursor_invalid",
  "balance_import_cursor_repeated",
  "balance_import_pagination_invalid",
  "balance_import_response_invalid",
  "balance_txn_import_failed",
  "body_too_large",
  "called_waitlist_email_missing",
  "canary_database_bundle_invalid",
  "canary_key_invalid",
  "canonical_origin_missing",
  "catalog_invalid",
  "catalog_unavailable",
  "catalog_window_invalid",
  "challenge_expired",
  "challenge_id_invalid",
  "challenge_token_invalid",
  "checkout_claim_rejected",
  "checkout_idempotency_conflict",
  "checkout_idempotency_key_invalid",
  "checkout_provider_reconciliation_required",
  "checkout_provider_response_invalid",
  "checkout_provider_result_conflict",
  "checkout_provider_result_rejected",
  "checkout_replay_budget_exceeded",
  "checkout_url_invalid",
  "clock_invalid",
  "confirmed_reservation_missing",
  "customer_email_missing",
  "declared_length_too_large",
  "email_delivery_endpoint_invalid",
  "email_job_subject_invalid",
  "email_notification_claim_failed",
  "email_notification_mark_failed",
  "email_notification_mark_sent_failed",
  "email_notifications_disabled",
  "email_template_invalid",
  "entry_link_unavailable",
  "entry_request_invalid",
  "entry_rpc_invalid",
  "evidence_database_bundle_invalid",
  "evidence_key_invalid",
  "evidence_version_invalid",
  "fulfilled_ticket_email_missing",
  "gate_c_observation_input_invalid",
  "gate_c_synthetic_cycle_id_invalid",
  "gate_c_synthetic_cycle_invalid",
  "gate_c_synthetic_event_cycle_invalid",
  "gate_c_synthetic_forbidden_in_production",
  "gate_c_synthetic_idempotency_scope_mismatch",
  "gate_c_synthetic_ledger_invalid",
  "gate_c_synthetic_ledger_invalid_json",
  "gate_c_synthetic_ledger_unavailable",
  "gate_c_synthetic_namespace_invalid",
  "gate_c_synthetic_refund_candidate_scope_mismatch",
  "gate_c_synthetic_refund_case_invalid",
  "gate_c_synthetic_refund_case_not_claimable",
  "gate_c_synthetic_refund_case_required",
  "gate_c_synthetic_refund_exact_claim_failed",
  "gate_c_synthetic_refund_payment_missing",
  "gate_c_synthetic_refund_scope_required",
  "gate_c_synthetic_request_scope_mismatch",
  "gate_c_synthetic_scope_mismatch",
  "gate_c_synthetic_turnstile_contract_invalid",
  "gate_c_synthetic_turnstile_token_invalid",
  "gate_c_synthetic_webhook_candidate_scope_mismatch",
  "gate_c_synthetic_webhook_claim_scope_mismatch",
  "gate_c_synthetic_webhook_event_invalid",
  "gate_c_synthetic_webhook_event_required",
  "gate_c_synthetic_webhook_exact_claim_failed",
  "gate_c_synthetic_webhook_not_claimable",
  "gate_c_synthetic_webhook_scope_required",
  "gate_c_synthetic_worker_scope_required",
  "incident_active_query_failed",
  "incident_batch_limit",
  "incident_batch_persistence_failed",
  "incident_cursor_persistence_failed",
  "incident_cursor_unavailable",
  "incident_detail_url_invalid",
  "incident_diagnostics_unavailable",
  "incident_environment_unconfigured",
  "incident_line_action_invalid",
  "incident_line_binding_invalid",
  "incident_line_claim_failed",
  "incident_line_detail_invalid",
  "incident_line_format_invalid",
  "incident_message_invalid",
  "incident_observation_invalid_or_stale",
  "incident_operations_invalid",
  "incident_persistence_failed",
  "incident_provider_evidence_persistence_failed",
  "incident_provider_evidence_unavailable",
  "incident_provider_work_unavailable",
  "incident_recovery_cursor_failed",
  "incident_release_changed",
  "incident_snapshot_persistence_failed",
  "incident_source_unavailable",
  "instant_invalid",
  "invalid_canonical_origin",
  "invalid_content_length",
  "invalid_customer_email",
  "invalid_customer_phone",
  "invalid_customer_profile_ciphertext",
  "invalid_decision",
  "invalid_destination",
  "invalid_dispatch_budget",
  "invalid_integer",
  "invalid_json",
  "invalid_json_body",
  "invalid_oidc_issuer",
  "invalid_request",
  "invalid_search",
  "invalid_search_response",
  "invalid_utf8",
  "json_body_too_large",
  "line_body_invalid",
  "line_channel_invalid",
  "line_guest_payment_lookup_failed",
  "line_notifications_disabled",
  "line_reservation_assignments_failed",
  "line_reservation_context_missing",
  "line_reservation_id_mismatch",
  "line_reservation_id_missing",
  "line_reservation_resources_failed",
  "line_target_id_invalid",
  "line_target_id_not_allowed",
  "live_mode_forbidden",
  "local_test_grant_invalid",
  "local_test_key_invalid",
  "mail_capacity_readback_failed",
  "mail_history_anchor_missing",
  "mail_history_day_changed",
  "mail_history_empty",
  "mail_history_http_",
  "mail_history_invalid",
  "mail_history_item_invalid",
  "mail_history_order_invalid",
  "mail_history_page_invalid",
  "mail_history_page_limit",
  "mail_history_rate_limit",
  "mail_history_recipients_invalid",
  "mail_history_response_large",
  "mail_history_scheduled_unsupported",
  "mail_policy_unavailable",
  "mail_renewal_invalid",
  "mail_reserve_configuration_missing",
  "mail_usage_key_invalid",
  "missing_checkout_url",
  "missing_customer_contact",
  "missing_line_target_id",
  "network_error",
  "otp_attempts_invalid",
  "otp_delivery_snapshot_invalid",
  "otp_invalid",
  "otp_request_rejected",
  "passkey_database_error",
  "payment_intent_not_succeeded",
  "payment_method_customer_not_found",
  "pending_operation_invalid",
  "pre_auth_authority_mismatch",
  "pre_auth_rejected",
  "profile_key_invalid",
  "provider_request_reconciliation_required",
  "public_booking_runtime_not_ready",
  "purchase_browser_required",
  "recipient_identity_invalid",
  "recipient_suppressed",
  "refund_not_succeeded",
  "request_body_invalid",
  "request_body_limit_invalid",
  "request_body_too_large",
  "request_fields_invalid",
  "reservation_hash_salt_required",
  "response_invalid",
  "runtime_environment_conflict",
  "runtime_environment_invalid",
  "scope_required",
  "server_error",
  "session_expired",
  "setup_intent_absent",
  "stripe_checkout_session_client_secret_missing",
  "stripe_checkout_setup_intent_missing",
  "stripe_payment_intent_client_secret_missing",
  "ticket_access_url_missing",
  "ticket_admissions_revoke_failed",
  "ticket_admit_failed",
  "ticket_alert_code_invalid",
  "ticket_alert_configuration_missing",
  "ticket_alert_dispatch_unavailable",
  "ticket_alert_payload_invalid",
  "ticket_canary_outbound_url_invalid",
  "ticket_canary_production_authority_rejected",
  "ticket_canary_recipient_hash_invalid",
  "ticket_canary_recipient_not_allowlisted",
  "ticket_canary_runtime_authority_invalid",
  "ticket_checkout_dispute_resolution_failed",
  "ticket_checkout_expiry_invalid",
  "ticket_checkout_payment_revoke_failed",
  "ticket_checkout_provider_binding_invalid",
  "ticket_checkout_provider_evidence_invalid",
  "ticket_checkout_provider_request_invalid",
  "ticket_checkout_rate_limit_clock_invalid",
  "ticket_checkout_rate_limit_hash_input_invalid",
  "ticket_checkout_rate_limit_invalid_result",
  "ticket_checkout_rate_limit_unavailable",
  "ticket_checkout_recovery_claim_failed",
  "ticket_checkout_recovery_cleanup_failed",
  "ticket_checkout_recovery_completion_rejected",
  "ticket_checkout_recovery_expiry_rejected",
  "ticket_checkout_recovery_input_invalid",
  "ticket_checkout_recovery_job_invalid",
  "ticket_checkout_refund_apply_failed",
  "ticket_checkout_replay_budget_clock_invalid",
  "ticket_checkout_replay_budget_input_invalid",
  "ticket_checkout_replay_budget_invalid_result",
  "ticket_checkout_replay_budget_unavailable",
  "ticket_checkout_replay_invalid",
  "ticket_checkout_replay_read_failed",
  "ticket_checkout_review_queue_unavailable",
  "ticket_checkout_review_resolve_failed",
  "ticket_checkout_session_authority_mismatch",
  "ticket_checkout_session_lookup_ambiguous",
  "ticket_checkout_session_lookup_failed",
  "ticket_checkout_session_missing",
  "ticket_commercial_snapshot_invalid",
  "ticket_daily_line_configuration_invalid",
  "ticket_daily_line_enqueue_failed",
  "ticket_daily_report_count_invalid",
  "ticket_daily_report_date_invalid",
  "ticket_daily_report_invalid",
  "ticket_daily_report_total_mismatch",
  "ticket_delivery_enqueue_failed",
  "ticket_demo_budget_unavailable",
  "ticket_demo_purchase_stopped",
  "ticket_dispute_event_timestamp_invalid",
  "ticket_dispute_resolution_failed",
  "ticket_event_day_missing",
  "ticket_event_session_conflict",
  "ticket_event_session_invalid",
  "ticket_event_time_invalid",
  "ticket_link_exchange_failed",
  "ticket_link_expiry_invalid",
  "ticket_link_params_missing",
  "ticket_local_test_authority_invalid",
  "ticket_local_test_recipient_hash_invalid",
  "ticket_local_test_recipient_not_allowlisted",
  "ticket_mail_capacity_unavailable",
  "ticket_maintenance_attempt_bound",
  "ticket_maintenance_deadline_invalid",
  "ticket_maintenance_operation_forbidden",
  "ticket_order_create_failed",
  "ticket_order_expire_failed",
  "ticket_order_fulfill_failed",
  "ticket_order_fulfill_mode_missing",
  "ticket_order_fulfill_wallet_secret_leak",
  "ticket_order_revoke_failed",
  "ticket_public_origin_invalid",
  "ticket_public_origin_missing",
  "ticket_purchase_origin_invalid",
  "ticket_purchase_origin_missing",
  "ticket_refund_apply_failed",
  "ticket_refund_result_order_missing",
  "ticket_sales_projection_unavailable",
  "trial_external_side_effect_blocked",
  "trial_pii_rejected",
  "trial_public_booking_blocked",
  "trial_run_id_required",
  "trial_supabase_ref_rejected",
  "unconfirmed",
  "wallet_admission_invalid",
  "wallet_admission_policy_invalid",
  "wallet_event_invalid",
  "wallet_event_window_invalid",
  "wallet_events_invalid",
  "wallet_session_authority_mismatch",
  "webhook_list_incomplete",
  "webhook_processing_disabled",
  "worker_result_persistence_failed",
]);

/**
 * Documented Stripe `decline_code` vocabulary (a fixed, provider-published
 * enumeration — membership is the secrecy proof, not the string shape).
 */
const KNOWN_STRIPE_DECLINE_CODES: ReadonlySet<string> = new Set([
  "approve_with_id",
  "authentication_required",
  "call_issuer",
  "card_not_supported",
  "card_velocity_exceeded",
  "currency_not_supported",
  "do_not_honor",
  "do_not_try_again",
  "duplicated_transaction",
  "expired_card",
  "fraudulent",
  "generic_decline",
  "incorrect_number",
  "incorrect_cvc",
  "incorrect_pin",
  "incorrect_zip",
  "insufficient_funds",
  "invalid_account",
  "invalid_amount",
  "invalid_cvc",
  "invalid_expiry_month",
  "invalid_expiry_year",
  "invalid_number",
  "invalid_pin",
  "issuer_not_available",
  "lost_card",
  "merchant_blacklist",
  "new_account_information_available",
  "no_action_taken",
  "not_permitted",
  "offline_pin_required",
  "online_or_offline_pin_required",
  "pickup_card",
  "pin_try_exceeded",
  "processing_error",
  "reenter_transaction",
  "revocation_of_all_authorizations",
  "revocation_of_authorization",
  "security_violation",
  "service_not_allowed",
  "stolen_card",
  "stop_payment_order",
  "testmode_decline",
  "transaction_not_allowed",
  "try_again_later",
  "withdrawal_count_limit_exceeded",
]);

/**
 * Documented Stripe error `code` vocabulary (the fixed error-code list Stripe
 * publishes for its API errors). Card errors frequently place a decline-code
 * value in `code`, so `code` is checked against the union of both lists.
 */
const KNOWN_STRIPE_ERROR_CODES: ReadonlySet<string> = new Set([
  "account_closed",
  "account_country_invalid_address",
  "account_error_country_change_requires_additional_steps",
  "account_information_mismatch",
  "account_invalid",
  "account_number_invalid",
  "acss_debit_session_incomplete",
  "alipay_upgrade_required",
  "amount_too_large",
  "amount_too_small",
  "api_key_expired",
  "authentication_required",
  "balance_insufficient",
  "balance_invalid_parameter",
  "bank_account_bad_routing_numbers",
  "bank_account_declined",
  "bank_account_must_be_verified",
  "bank_account_restricted",
  "bank_account_unusable",
  "bank_account_unverified",
  "bank_account_verification_failed",
  "billing_invalid_mandate",
  "bitcoin_upgrade_required",
  "capture_charge_authorization_expired",
  "capture_unauthorized_payment",
  "card_decline_rate_limit_exceeded",
  "card_declined",
  "cardholder_phone_number_required",
  "charge_already_captured",
  "charge_already_refunded",
  "charge_disputed",
  "charge_exceeds_source_limit",
  "charge_exceeds_transaction_limit",
  "charge_expired_for_capture",
  "charge_invalid_parameter",
  "charge_not_refundable",
  "clearing_code_unsupported",
  "confirmation_code_incorrect",
  "confirmation_code_max_attempts_exceeded",
  "confirmation_unexpected_payment_method",
  "conflicting_payment_method_options",
  "country_unsupported",
  "coupon_expired",
  "customer_max_payment_methods",
  "customer_max_subscriptions",
  "customer_session_expired",
  "customer_tax_location_invalid",
  "deleting_source_not_allowed",
  "email_invalid",
  "email_required",
  "financial_account_not_open",
  "financial_account_rails_unavailable",
  "idempotency_key_in_use",
  "incorrect_address",
  "instant_payouts_config_disabled",
  "instant_payouts_currency_disabled",
  "instant_payouts_limit_exceeded",
  "insufficient_funds",
  "intent_invalid_state",
  "intent_verification_method_missing",
  "invalid_characters",
  "invalid_charge_amount",
  "invalid_client_token",
  "invalid_expiry_month",
  "invalid_expiry_year",
  "invalid_mandate_reference_prefix_format",
  "invalid_number",
  "invalid_source_usage",
  "invalid_tax_location",
  "invoice_no_customer_line_items",
  "invoice_no_payment_method_types",
  "invoice_no_subscription_line_items",
  "invoice_not_editable",
  "invoice_on_behalf_of_not_editable",
  "invoice_payment_intent_requires_action",
  "invoice_upcoming_none",
  "livemode_mismatch",
  "lock_timeout",
  "merchant_account_exists",
  "merchant_country_not_supported",
  "missing",
  "no_account",
  "not_allowed_on_standard_account",
  "out_of_inventory",
  "ownership_domain_not_verified",
  "parameter_invalid_empty",
  "parameter_invalid_integer",
  "parameter_invalid_string_blank",
  "parameter_invalid_string_empty",
  "parameter_missing",
  "parameter_unknown",
  "parameters_exclusive",
  "payment_intent_action_required",
  "payment_intent_authentication_failure",
  "payment_intent_incompatible_payment_method",
  "payment_intent_invalid_parameter",
  "payment_intent_konbini_rejected_confirmation_number",
  "payment_intent_mandate_invalid",
  "payment_intent_payment_attempt_expired",
  "payment_intent_payment_attempt_failed",
  "payment_intent_unexpected_state",
  "payment_link_inactive_payment_method",
  "payment_method_bank_account_already_verified",
  "payment_method_bank_account_blocked",
  "payment_method_billing_details_address_missing",
  "payment_method_cannot_be_shared",
  "payment_method_configuration_not_allowed",
  "payment_method_currency_mismatch",
  "payment_method_customer_decline",
  "payment_method_invalid_parameter",
  "payment_method_invalid_parameter_testmode",
  "payment_method_microdeposit_failed",
  "payment_method_microdeposit_verification_amounts_invalid",
  "payment_method_microdeposit_verification_amounts_mismatch",
  "payment_method_microdeposit_verification_attempts_exceeded",
  "payment_method_microdeposit_verification_descriptor_code_mismatch",
  "payment_method_microdeposit_verification_timeout",
  "payment_method_not_available",
  "payment_method_provider_decline",
  "payment_method_provider_timeout",
  "payment_method_unactivated",
  "payment_method_unexpected_state",
  "payment_method_unsupported_type",
  "payout_method_selector_missing",
  "payouts_limit_exceeded",
  "payouts_not_allowed",
  "platform_account_required",
  "platform_api_key_expired",
  "postal_code_invalid",
  "product_inactive",
  "progressive_onboarding_limit_exceeded",
  "rate_limit",
  "recaptcha_verification_failed",
  "refer_to_customer",
  "refund_disputed_payment",
  "resource_already_exists",
  "resource_missing",
  "return_intent_already_processed",
  "routing_number_invalid",
  "secret_key_required",
  "sepa_unsupported_account",
  "setup_attempt_failed",
  "setup_intent_authentication_failure",
  "setup_intent_invalid_parameter",
  "setup_intent_mandate_invalid",
  "setup_intent_mobile_wallet_unsupported",
  "setup_intent_setup_attempt_expired",
  "setup_intent_unexpected_state",
  "shipping_calculation_failed",
  "sku_inactive",
  "state_unsupported",
  "status_transition_invalid",
  "stripe_tax_inactive",
  "tax_id_invalid",
  "taxes_calculation_failed",
  "terminal_location_country_unsupported",
  "terminal_reader_busy",
  "terminal_reader_hardware_fault",
  "terminal_reader_invalid_location_for_activation",
  "terminal_reader_invalid_location_for_payment",
  "terminal_reader_offline",
  "terminal_reader_timeout",
  "terminal_reader_vector_version_currently_deprecated",
  "terminal_zone_country_unsupported",
  "testmode_charges_only",
  "tls_version_unsupported",
  "token_already_used",
  "token_card_network_invalid",
  "token_in_use",
  "transfer_source_balance_parameters_mismatch",
  "transfers_not_allowed",
  "url_invalid",
]);

const KNOWN_STRIPE_PROVIDER_CODES: ReadonlySet<string> = new Set([
  ...KNOWN_STRIPE_DECLINE_CODES,
  ...KNOWN_STRIPE_ERROR_CODES,
]);

/**
 * Bucket emitted when a recognized provider error carries a code outside the
 * documented vocabulary. The field stays populated (triage keeps "a provider
 * code existed") without ever persisting the unrecognized value itself.
 */
const PROVIDER_CODE_UNMAPPED = "provider_code_unmapped";

// Correlation fields are minted server-side (UUIDs, `req_…`, action ids) but
// some callers pass route/body params through unvalidated — shape-sanitize at
// the sink so a caller bug can never widen the log schema (RR-01).
const CONTEXT_ID = /^[A-Za-z0-9._-]{1,64}$/u;
const CONTEXT_LABEL = /^[a-z][a-z0-9_.-]{1,64}$/u;

function sanitizeContextId(value: string | undefined) {
  return typeof value === "string" && CONTEXT_ID.test(value) ? value : null;
}

function sanitizeContextLabel(value: string | undefined) {
  return typeof value === "string" && CONTEXT_LABEL.test(value) ? value : null;
}

export type SafeErrorContext = Readonly<{
  /** Logical route/action, e.g. "tickets.checkout" or "stripe.webhook.store". */
  scope: string;
  /** Processing stage when the error escaped, e.g. "claim" | "provider_create". */
  stage?: string;
  /** Correlation id generated for this request (never a user-provided one). */
  requestId?: string;
  /** Stable domain object ids, e.g. ticket_checkout_action_id, order id. */
  actionId?: string;
  orderId?: string;
  /** Provider request id when the provider echoed one back (Stripe `req_…`). */
  providerRequestId?: string;
}>;

type ErrorClassification = Readonly<{
  category: string;
  sqlState: string | null;
  providerType: string | null;
  providerCode: string | null;
  providerRequestId: string | null;
  httpStatus: number | null;
}>;

const UNKNOWN_CLASSIFICATION: ErrorClassification = Object.freeze({
  category: "unknown_error",
  sqlState: null,
  providerType: null,
  providerCode: null,
  providerRequestId: null,
  httpStatus: null,
});

export function classifyError(error: unknown): ErrorClassification {
  return classifyErrorAtDepth(error, 0);
}

function classifyErrorAtDepth(error: unknown, depth: number): ErrorClassification {
  if (!(error instanceof Error) && (typeof error !== "object" || error === null)) {
    return UNKNOWN_CLASSIFICATION;
  }

  const row = error as Record<string, unknown>;
  let sqlState = typeof row.code === "string" && SQL_STATE.test(row.code)
    ? row.code
    : null;

  let providerType = typeof row.type === "string" && STRIPE_TYPES.has(row.type)
    ? row.type
    : (typeof row.name === "string" && STRIPE_TYPES.has(row.name) ? row.name : null);

  const rawCode = typeof row.code === "string" && STRIPE_DECLINE.test(row.code)
    ? row.code
    : null;
  const rawDeclineCode = typeof row.decline_code === "string" && STRIPE_DECLINE.test(row.decline_code)
    ? row.decline_code
    : null;

  // A provider code is only ever adopted alongside a recognized provider type
  // AND when the value is a documented Stripe vocabulary member. A
  // `decline_code` with no provider type is dropped entirely; unrecognized
  // values collapse to a fixed bucket — the raw string is never emitted.
  let providerCode: string | null = null;
  if (providerType) {
    if (rawDeclineCode !== null && KNOWN_STRIPE_DECLINE_CODES.has(rawDeclineCode)) {
      providerCode = rawDeclineCode;
    } else if (rawCode !== null && KNOWN_STRIPE_PROVIDER_CODES.has(rawCode)) {
      providerCode = rawCode;
    } else if (rawDeclineCode !== null || rawCode !== null) {
      providerCode = PROVIDER_CODE_UNMAPPED;
    }
  }

  let providerRequestId = typeof row.requestId === "string" && STRIPE_REQUEST_ID.test(row.requestId)
    ? row.requestId
    : null;

  let httpStatus = typeof row.status === "number" && row.status >= 100 && row.status <= 599
    ? row.status
    : (typeof row.statusCode === "number" && row.statusCode >= 100 && row.statusCode <= 599
      ? row.statusCode
      : null);

  let category = "unknown_error";
  if (providerType) {
    category = providerType;
  } else if (sqlState) {
    category = `db_${sqlState}`;
  } else if (typeof row.message === "string" && INTERNAL_ERROR_CATEGORIES.has(row.message)) {
    // Internal errors in this codebase throw snake_case contract messages
    // (e.g. `ticket_checkout_rate_limit_unavailable`). The message is the safe
    // category ONLY when it is a member of the checked-in registry — matching
    // the snake_case shape is not proof a string is a contract code, and a
    // secret that happens to be lower-case must never be adopted (RR-01).
    // Structural check, not `instanceof`, so cross-realm errors (vm test
    // sandboxes, workers) behave identically.
    category = row.message;
  } else if (typeof row.code === "string" && INTERNAL_ERROR_CATEGORIES.has(row.code)) {
    // Typed errors (e.g. HttpBodyError) carry the contract code in `code`
    // while `message` stays free text.
    category = row.code;
  } else if (typeof row.name === "string" && /^[A-Z][A-Za-z]+Error$/u.test(row.name)) {
    category = `js_${row.name}`;
  }

  // A typed wrapper (`Error(<contract_code>, { cause })`) inherits the
  // safe classification fields of its cause — never the category — so the
  // persisted detail keeps the underlying sqlState/provider/http class.
  if (depth === 0 && typeof row.cause === "object" && row.cause !== null && row.cause !== error) {
    const cause = classifyErrorAtDepth(row.cause, depth + 1);
    sqlState ??= cause.sqlState;
    providerType ??= cause.providerType;
    providerCode ??= cause.providerCode;
    providerRequestId ??= cause.providerRequestId;
    httpStatus ??= cause.httpStatus;
  }

  return Object.freeze({
    category: category.slice(0, 96),
    sqlState,
    providerType,
    providerCode,
    providerRequestId,
    httpStatus,
  });
}

/**
 * Compact single-token detail for persistence into error_json /
 * last_error_message columns that feed the admin dead-items surface. Same
 * allowlist as the log path — raw messages are never stored. Output shape is
 * `category[:providerCode][:sqlState][:http_NNN]` — never contains spaces, so
 * readers can distinguish it from free-text legacy values.
 */
export function persistedErrorDetail(error: unknown): string {
  const classification = classifyError(error);
  return [
    classification.category,
    classification.providerCode,
    classification.sqlState,
    classification.httpStatus === null ? null : `http_${classification.httpStatus}`,
  ]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(":")
    .slice(0, 200);
}

export function logSafeError(context: SafeErrorContext, error: unknown) {
  const classification = classifyError(error);
  const contextProviderRequestId =
    typeof context.providerRequestId === "string" && STRIPE_REQUEST_ID.test(context.providerRequestId)
      ? context.providerRequestId
      : null;
  console.error(
    JSON.stringify({
      event: "server_error",
      scope: sanitizeContextLabel(context.scope),
      stage: sanitizeContextLabel(context.stage),
      requestId: sanitizeContextId(context.requestId),
      actionId: sanitizeContextId(context.actionId),
      orderId: sanitizeContextId(context.orderId),
      providerRequestId: contextProviderRequestId ?? classification.providerRequestId,
      category: classification.category,
      sqlState: classification.sqlState,
      providerType: classification.providerType,
      providerCode: classification.providerCode,
      httpStatus: classification.httpStatus,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    }),
  );
}
