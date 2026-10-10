export type TicketWalletReadinessInputs = {
  /** Explicit isolated local delivery testing; never provider/DNS evidence. */
  localEmailDeliveryOnly?: boolean;
  dbContractMatches: boolean;
  authKeyringConfigured: boolean;
  secretsIndependent: boolean;
  publicOriginIsHttps: boolean;
  purchaserEmailEncryptionConfigured: boolean;
  purchaserEmailHashConfigured: boolean;
  emailProvider: string | null;
  resendApiKeyConfigured: boolean;
  resendWebhookSecretConfigured: boolean;
  resendFromConfigured: boolean;
  resendActivationAttested: boolean;
  turnstileSiteKeyConfigured: boolean;
  turnstileSecretKeyConfigured: boolean;
  walletReadEnabled: boolean;
  otpDeliveryEnabled: boolean;
  swipePrepareEnabled: boolean;
  swipeCommitEnabled: boolean;
  managerOperationsEnabled: boolean;
  refundReviewEnabled: boolean;
  providerWebhookEnabled: boolean;
  ownerAuthReady: boolean;
};

export type CapabilityReadiness = {
  ok: boolean;
  missing: string[];
};

export type TicketWalletReadiness = {
  walletRead: CapabilityReadiness;
  /** Public OTP bootstrap/request ingress, including its customer feature gate. */
  otpDelivery: CapabilityReadiness;
  /**
   * Feature-independent durable email configuration. The database claim remains
   * authoritative for the live provider circuit, cadence and suppressions.
   */
  transactionalEmailDrain: CapabilityReadiness;
  swipePrepare: CapabilityReadiness;
  swipeCommit: CapabilityReadiness;
  managerOperations: CapabilityReadiness;
  refundReview: CapabilityReadiness;
  providerWebhook: CapabilityReadiness;
  walletCheckout: CapabilityReadiness;
};

export function evaluateTicketWalletReadiness(
  inputs: TicketWalletReadinessInputs,
): TicketWalletReadiness {
  const walletBase = missingCapabilities([
    [inputs.dbContractMatches, "TICKET_WALLET_DB_CONTRACT"],
    [inputs.authKeyringConfigured, "TICKET_AUTH_KEYRING"],
    [inputs.secretsIndependent, "TICKET_WALLET_SECRET_INDEPENDENCE"],
    [inputs.publicOriginIsHttps, "TICKET_WALLET_PUBLIC_ORIGIN"],
    [inputs.purchaserEmailHashConfigured, "TICKET_LINK_SECRET"],
  ]);
  const providerBase = missingCapabilities([
    [inputs.emailProvider === "resend", "EMAIL_PROVIDER=resend"],
    [inputs.resendApiKeyConfigured, "RESEND_API_KEY"],
    [inputs.resendWebhookSecretConfigured || inputs.localEmailDeliveryOnly === true, "RESEND_WEBHOOK_SECRET"],
    [inputs.resendFromConfigured, "RESEND_FROM"],
    [inputs.resendActivationAttested || inputs.localEmailDeliveryOnly === true, "RESEND_ACTIVATION_ATTESTATION_SHA256"],
    [inputs.purchaserEmailEncryptionConfigured, "VIP_CUSTOMER_PROFILE_ENCRYPTION_KEY"],
  ]);
  const transactionalEmailBase = missingCapabilities([
    [inputs.dbContractMatches, "TICKET_WALLET_DB_CONTRACT"],
    [inputs.authKeyringConfigured, "TICKET_AUTH_KEYRING"],
    [inputs.secretsIndependent, "TICKET_WALLET_SECRET_INDEPENDENCE"],
    [inputs.purchaserEmailHashConfigured, "TICKET_LINK_SECRET"],
  ]);

  const walletRead = readiness([
    [inputs.walletReadEnabled, "FEATURE_TICKET_WALLET_READ_ENABLED"],
  ], walletBase);
  const otpDelivery = readiness([
    [inputs.otpDeliveryEnabled, "FEATURE_TICKET_OTP_DELIVERY_ENABLED"],
    [inputs.turnstileSiteKeyConfigured, "TURNSTILE_SITE_KEY"],
    [inputs.turnstileSecretKeyConfigured, "TURNSTILE_SECRET_KEY"],
  ], walletBase, providerBase);
  const transactionalEmailDrain = readiness([], transactionalEmailBase, providerBase);
  const swipePrepare = readiness([
    [inputs.swipePrepareEnabled, "FEATURE_TICKET_SWIPE_PREPARE_ENABLED"],
  ], walletBase);
  const swipeCommit = readiness([
    [inputs.swipeCommitEnabled, "FEATURE_TICKET_SWIPE_COMMIT_ENABLED"],
  ], walletBase);
  const managerOperations = readiness([
    [inputs.managerOperationsEnabled, "FEATURE_TICKET_MANAGER_OPERATIONS_ENABLED"],
    [inputs.dbContractMatches, "TICKET_WALLET_DB_CONTRACT"],
    [inputs.ownerAuthReady, "OWNER_AUTHORITY"],
  ]);
  const refundReview = readiness([
    [inputs.refundReviewEnabled, "FEATURE_TICKET_REFUND_REVIEW_ENABLED"],
    [inputs.dbContractMatches, "TICKET_WALLET_DB_CONTRACT"],
    [inputs.ownerAuthReady, "OWNER_AUTHORITY"],
  ]);
  const providerWebhook = readiness([
    [inputs.providerWebhookEnabled, "FEATURE_EMAIL_PROVIDER_WEBHOOK_ENABLED"],
    [!inputs.localEmailDeliveryOnly, "LOCAL_EMAIL_DELIVERY_ONLY"],
  ], transactionalEmailDrain.missing);
  const walletCheckout = mergeReadiness(
    walletRead,
    otpDelivery,
    transactionalEmailDrain,
    swipePrepare,
    swipeCommit,
    managerOperations,
    refundReview,
    ...(inputs.localEmailDeliveryOnly ? [] : [providerWebhook]),
  );

  return {
    walletRead,
    otpDelivery,
    transactionalEmailDrain,
    swipePrepare,
    swipeCommit,
    managerOperations,
    refundReview,
    providerWebhook,
    walletCheckout,
  };
}

function readiness(
  checks: ReadonlyArray<readonly [boolean, string]>,
  ...additionalMissing: ReadonlyArray<readonly string[]>
): CapabilityReadiness {
  const missing = unique([
    ...missingCapabilities(checks),
    ...additionalMissing.flat(),
  ]);
  return { ok: missing.length === 0, missing };
}

function mergeReadiness(...capabilities: CapabilityReadiness[]): CapabilityReadiness {
  const missing = unique(capabilities.flatMap((capability) => capability.missing));
  return { ok: missing.length === 0, missing };
}

function missingCapabilities(checks: ReadonlyArray<readonly [boolean, string]>) {
  return checks.flatMap(([present, name]) => present ? [] : [name]);
}

function unique(values: string[]) {
  return [...new Set(values)];
}
