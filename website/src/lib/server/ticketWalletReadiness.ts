import "server-only";
import { isPureLocalEmailTest } from "./pureLocalEmail";
import { ticketLocalTestIsAuthorized } from "./tickets/ticketLocalTestAuthority";
import { ticketRevisionCanaryIsAuthorized } from "./tickets/ticketRevisionCanary";
import { ticketRevisionIsReady } from "./tickets/ticketRevisionReadiness";

import { evaluateTicketWalletReadiness } from "../tickets/ticketWalletReadiness";
import { getCustomerProfileCryptoConfiguration } from "./customerProfileCrypto";
import { isFeatureEnabled } from "./featureFlags";
import { isExactPublicOrigin } from "./httpBoundary";
import { isTicketLinkSecretConfigured } from "./tickets/admissionCodes";
import { readTicketAuthKeyring } from "./tickets/ticketAuthCrypto";
import { ticketWalletSecretsAreIndependent } from "./tickets/ticketWalletSecretIndependence";
import { TICKET_FULFILLMENT_CONTRACT } from "./tickets/ticketOrders";
import { evaluateResendActivationEnvironment } from "./transactionalEmail/resendActivationEnvironment";

export const REQUIRED_TICKET_WALLET_DB_CONTRACT = "ghost.tickets.v30";

export function getTicketWalletReadiness(event?: {eventId:string;businessDate:string;eventSessionId?:string}) {
  const customerCrypto = getCustomerProfileCryptoConfiguration();
  const resend = evaluateResendActivationEnvironment(process.env);
  const readiness = evaluateTicketWalletReadiness({
    localEmailDeliveryOnly: isPureLocalEmailTest(),
    dbContractMatches:
      TICKET_FULFILLMENT_CONTRACT === REQUIRED_TICKET_WALLET_DB_CONTRACT
      && process.env.TICKET_WALLET_DB_CONTRACT === REQUIRED_TICKET_WALLET_DB_CONTRACT,
    authKeyringConfigured: hasValidTicketAuthKeyring(),
    secretsIndependent: ticketWalletSecretsAreIndependent(process.env),
    publicOriginIsHttps: isExactHttpsOrigin(process.env.TICKET_WALLET_PUBLIC_ORIGIN),
    purchaserEmailEncryptionConfigured: customerCrypto.encryptionKeyConfigured,
    purchaserEmailHashConfigured: isTicketLinkSecretConfigured(),
    emailProvider: resend.provider,
    resendApiKeyConfigured: resend.apiKeyConfigured,
    resendWebhookSecretConfigured: resend.webhookSecretConfigured,
    resendFromConfigured: resend.fromConfigured,
    resendActivationAttested: resend.activationAttested,
    turnstileSiteKeyConfigured: hasConfiguredValue(process.env.TURNSTILE_SITE_KEY),
    turnstileSecretKeyConfigured: hasConfiguredValue(process.env.TURNSTILE_SECRET_KEY),
    walletReadEnabled: isFeatureEnabled("FEATURE_TICKET_WALLET_READ_ENABLED"),
    otpDeliveryEnabled: isFeatureEnabled("FEATURE_TICKET_OTP_DELIVERY_ENABLED"),
    swipePrepareEnabled: isFeatureEnabled("FEATURE_TICKET_SWIPE_PREPARE_ENABLED"),
    swipeCommitEnabled: isFeatureEnabled("FEATURE_TICKET_SWIPE_COMMIT_ENABLED"),
    managerOperationsEnabled: isFeatureEnabled("FEATURE_TICKET_MANAGER_OPERATIONS_ENABLED"),
    refundReviewEnabled: isFeatureEnabled("FEATURE_TICKET_REFUND_REVIEW_ENABLED"),
    providerWebhookEnabled: isFeatureEnabled("FEATURE_EMAIL_PROVIDER_WEBHOOK_ENABLED"),
    ownerAuthReady: Boolean(
      process.env.ADMIN_SESSION_HASH_SALT ?? process.env.RESERVATION_HASH_SALT,
    ),
  });
  if (!ticketRevisionIsReady("A", process.env, Date.now(), event) && !ticketRevisionCanaryIsAuthorized("A") && !ticketLocalTestIsAuthorized(process.env)) {
    readiness.walletCheckout = { ok: false, missing: [...readiness.walletCheckout.missing, "TICKETS_REVISION2_PHASE_A_EVIDENCE"] };
  }
  return readiness;
}

function hasValidTicketAuthKeyring() {
  try {
    readTicketAuthKeyring();
    return true;
  } catch {
    return false;
  }
}

function isExactHttpsOrigin(value: string | undefined) {
  if (!value) return false;
  return isExactPublicOrigin(value.replace(/\/$/u, ""));
}

function hasConfiguredValue(value: string | undefined) {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 4_096 && !/[\r\n]/u.test(trimmed);
}
