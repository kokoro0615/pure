import "server-only";
import { isPureLocalEmailTest } from "../pureLocalEmail";

export type ResendRuntimeEnvironment = Readonly<Record<string, string | undefined>> & Readonly<{
  EMAIL_PROVIDER?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  RESEND_REPLY_TO?: string;
  RESEND_WEBHOOK_SECRET?: string;
  RESEND_WEBHOOK_LEGACY_SECRETS?: string;
}>;

export type ResendRuntimeConfiguration = Readonly<{
  provider: "resend";
  apiKey: string;
  from: string;
  replyTo: string | null;
  webhookSecrets: readonly string[];
}>;

export type InspectedResendRuntimeConfiguration = Readonly<{
  provider: "resend" | null;
  apiKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  fromConfigured: boolean;
  configuration: ResendRuntimeConfiguration | null;
}>;

export function inspectResendRuntimeConfiguration(
  environment: ResendRuntimeEnvironment,
): InspectedResendRuntimeConfiguration {
  const provider = environment.EMAIL_PROVIDER === "resend" ? "resend" : null;
  const apiKey = isResendSecretValue(environment.RESEND_API_KEY)
    ? environment.RESEND_API_KEY
    : null;
  const from = readSenderMailbox(environment.RESEND_FROM);
  const replyTo = readOptionalReplyTo(environment.RESEND_REPLY_TO);
  const localTest = isPureLocalEmailTest(environment);
  const webhookSecrets = localTest ? [] : readWebhookSecrets(
    environment.RESEND_WEBHOOK_SECRET,
    environment.RESEND_WEBHOOK_LEGACY_SECRETS,
  );
  const fromConfigured = from !== null && replyTo.valid;
  const configuration = provider !== null
    && apiKey !== null
    && fromConfigured
    && webhookSecrets !== null
    ? Object.freeze({
      provider,
      apiKey,
      from,
      replyTo: replyTo.value,
      webhookSecrets,
    })
    : null;

  return Object.freeze({
    provider,
    apiKeyConfigured: apiKey !== null,
    webhookSecretConfigured: !localTest && webhookSecrets !== null,
    fromConfigured,
    configuration,
  });
}

export function requireResendRuntimeConfiguration(
  environment: ResendRuntimeEnvironment,
): ResendRuntimeConfiguration {
  const configuration = inspectResendRuntimeConfiguration(environment).configuration;
  if (!configuration) throw new Error("RESEND_RUNTIME_INVALID_CONFIG");
  return configuration;
}

export function isResendSecretValue(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 8
    && value.length <= 1_024
    && value.trim() === value
    && !/[\r\n\0]/u.test(value);
}

function readSenderMailbox(value: string | undefined) {
  if (!isBoundedHeaderValue(value)) return null;
  if (!value.includes("<") && !value.includes(">")) {
    return isMailboxAddress(value) ? value : null;
  }
  const match = /^([^<>]+) <([^<>]+)>$/u.exec(value);
  return match
    && match[1].trim() === match[1]
    && match[1].length > 0
    && isMailboxAddress(match[2])
    ? value
    : null;
}

function readOptionalReplyTo(value: string | undefined) {
  if (value === undefined || value === "") {
    return Object.freeze({ valid: true as const, value: null });
  }
  return isBoundedHeaderValue(value) && isMailboxAddress(value)
    ? Object.freeze({ valid: true as const, value })
    : Object.freeze({ valid: false as const, value: null });
}

function readWebhookSecrets(primary: string | undefined, legacyValue: string | undefined) {
  if (!isResendSecretValue(primary)) return null;
  let legacy: string[] = [];
  if (legacyValue !== undefined && legacyValue !== "") {
    if (
      legacyValue.length > 4_096
      || legacyValue.trim() !== legacyValue
      || /[\r\n\0]/u.test(legacyValue)
    ) {
      return null;
    }
    legacy = legacyValue.split(",").map((value) => value.trim());
    if (
      legacy.length > 2
      || legacy.some((value) => !isResendSecretValue(value))
    ) {
      return null;
    }
  }
  const secrets = [primary, ...legacy];
  return new Set(secrets).size === secrets.length
    ? Object.freeze(secrets)
    : null;
}

function isBoundedHeaderValue(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 320
    && value.trim() === value
    && !/[\r\n\0]/u.test(value);
}

function isMailboxAddress(value: string) {
  return value.length <= 254
    && /^[^\s<>@]+@[^\s<>@]+$/u.test(value);
}
