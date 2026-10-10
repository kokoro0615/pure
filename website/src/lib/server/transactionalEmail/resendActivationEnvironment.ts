import "server-only";

import { verifyResendActivationAttestation } from "./resendActivationAttestation";
import {
  inspectResendRuntimeConfiguration,
  type ResendRuntimeEnvironment,
} from "./resendRuntimeConfiguration";

export type ResendActivationEnvironment = ResendRuntimeEnvironment & Readonly<{
  RESEND_ACTIVATION_ATTESTATION?: string;
  RESEND_ACTIVATION_ATTESTATION_SHA256?: string;
}>;

export function evaluateResendActivationEnvironment(
  environment: ResendActivationEnvironment,
  now = Date.now(),
) {
  const inspected = inspectResendRuntimeConfiguration(environment);
  const configuration = inspected.configuration;
  const verify = (enforceAge: boolean) => configuration !== null && verifyResendActivationAttestation({
    serializedAttestation: environment.RESEND_ACTIVATION_ATTESTATION,
    signatureSha256: environment.RESEND_ACTIVATION_ATTESTATION_SHA256,
    webhookSecret: configuration.webhookSecrets[0],
    provider: configuration.provider,
    from: configuration.from,
    now,
    enforceAge,
  });
  return {
    provider: inspected.provider,
    apiKeyConfigured: inspected.apiKeyConfigured,
    webhookSecretConfigured: inspected.webhookSecretConfigured,
    fromConfigured: inspected.fromConfigured,
    // Readiness: the attestation must be genuine and bound to this provider
    // configuration. Its age is a monitoring signal only (Owner decision
    // 2026-09-17), so an old attestation never stops ticket sales.
    activationAttested: verify(false),
    activationCurrent: verify(true),
  } as const;
}

/** Independent freshness warning; never renews or fabricates provider evidence. */
export function resendActivationAlerts(environment: ResendActivationEnvironment, now = Date.now()): string[] {
  if (!evaluateResendActivationEnvironment(environment, now).activationCurrent) return ['resend_attestation_unavailable'];
  try {
    const attestation = JSON.parse(environment.RESEND_ACTIVATION_ATTESTATION!);
    return Date.parse(attestation.verifiedAt) + 7 * 86400_000 - now <= 48 * 3600_000
      ? ['resend_attestation_expiring'] : [];
  } catch { return ['resend_attestation_unavailable']; }
}
