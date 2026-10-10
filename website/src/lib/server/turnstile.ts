import { requireServerEnv } from "./env";
import { readIngressClientIp } from "./ingressClientIp";
import { readPureProfile } from "./pureRuntime";

export type TurnstileVerificationResult =
  | Readonly<{ ok: true }>
  | Readonly<{
    ok: false;
    error: "missing_turnstile_token" | "turnstile_failed" | "turnstile_unavailable";
    errorCodes?: readonly string[];
  }>;

export type TurnstileVerificationContext = Readonly<{
  /**
   * Hostname that must appear in the provider response. Binds the token to
   * the surface the widget actually rendered on; a token minted on a
   * different site, deployment, or Ghost surface using the same sitekey is
   * rejected.
   */
  expectedHostname?: string;
  /**
   * Widget `data-action` the caller expects. Callers only set this when the
   * rendering surface passes a matching `data-action`; otherwise a mismatch
   * would reject legitimate tokens.
   */
  expectedAction?: string;
}>;

type SiteverifyResult = {
  success?: boolean;
  "error-codes"?: string[];
  hostname?: string;
  action?: string;
  challenge_ts?: string;
  cdata?: string;
};

// Siteverify is on the critical path of purchase/hold/OTP flows. Without an
// explicit deadline a stalled Cloudflare response parks the request — and the
// caller's upstream budget — indefinitely. Five seconds matches the wallet
// route budgets (maxDuration 15s) while leaving room for a slow provider.
const SITEVERIFY_TIMEOUT_MS = 5_000;

/**
 * Local verification path. Active when the configured secret is Cloudflare's
 * documented always-pass test secret (`1x0000...`) or the local-mock profile
 * runs without a real secret. Honors the same dummy-token conventions:
 * `XXXX.DUMMY.TOKEN.XXXX` passes, `XXXX.FAKE` fails, anything else fails —
 * so hold/checkout flows keep a real pass/fail boundary without a provider.
 */
function verifyTurnstileTokenLocally(
  token: string,
  context: TurnstileVerificationContext,
): TurnstileVerificationResult {
  void context;
  if (token === "XXXX.DUMMY.TOKEN.XXXX" || token === "pure-turnstile-pass") {
    return { ok: true };
  }
  return { ok: false, error: "turnstile_failed", errorCodes: ["invalid_token_local"] };
}

function shouldVerifyLocally(): boolean {
  // Production always asks Cloudflare: Cloudflare's always-pass test secret
  // or the local dummy tokens must never satisfy a real visitor check.
  if (readPureProfile() === "production") {
    return false;
  }
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (secret?.startsWith("1x0000000000000000000")) {
    return true;
  }
  return readPureProfile() === "local-mock" && (!secret || secret.startsWith("pure_"));
}

export async function verifyTurnstileToken(
  token: string | null,
  request: Request,
  context: TurnstileVerificationContext = {},
): Promise<TurnstileVerificationResult> {
  if (!token) {
    return { ok: false, error: "missing_turnstile_token" };
  }

  if (shouldVerifyLocally()) {
    return verifyTurnstileTokenLocally(token, context);
  }

  const formData = new FormData();
  formData.set("secret", requireServerEnv("TURNSTILE_SECRET_KEY"));
  formData.set("response", token);

  // G-17: only platform-asserted IP headers; cf-connecting-ip is
  // client-controllable on Vercel and must not reach the provider.
  const remoteIp = readIngressClientIp(request);

  if (remoteIp !== "unknown") {
    formData.set("remoteip", remoteIp);
  }

  let response: Response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
  } catch {
    // Timeouts and transport failures fail closed at the caller as
    // "turnstile_unavailable" — a hold/checkout must never proceed on an
    // unverified token.
    return { ok: false, error: "turnstile_unavailable" };
  }

  if (!response.ok) {
    return { ok: false, error: "turnstile_unavailable" };
  }

  let result: SiteverifyResult;
  try {
    result = (await response.json()) as SiteverifyResult;
  } catch {
    return { ok: false, error: "turnstile_unavailable" };
  }

  if (!result.success) {
    return {
      ok: false as const,
      error: "turnstile_failed",
      errorCodes: result["error-codes"] ?? [],
    };
  }

  if (
    context.expectedHostname
    && result.hostname?.toLowerCase() !== context.expectedHostname.toLowerCase()
  ) {
    return {
      ok: false as const,
      error: "turnstile_failed",
      errorCodes: ["hostname_mismatch"],
    };
  }

  if (context.expectedAction && result.action !== context.expectedAction) {
    return {
      ok: false as const,
      error: "turnstile_failed",
      errorCodes: ["action_mismatch"],
    };
  }

  return { ok: true as const };
}
