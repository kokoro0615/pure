import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const PURE_LOCAL_EMAIL_LIMIT = 10;

/** Local tests send real emails without publishing a webhook endpoint. This is
 * an explicit development capability, never a production activation attestation. */
export function isPureLocalEmailTest(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    env.PURE_LOCAL_EMAIL_TEST_ENABLED === "true" &&
    env.PURE_PROFILE === "pure-dev" &&
    env.PURE_ENVIRONMENT === "test" &&
    env.TICKET_WALLET_PUBLIC_ORIGIN === "https://localhost:3101" &&
    env.SUPABASE_URL === "https://airgkuioqioknxuqpciq.supabase.co" &&
    /^[sr]k_test_/.test(env.STRIPE_SECRET_KEY ?? "") &&
    !Object.keys(env).some(
      (key) => /^(VERCEL|NOW_DEPLOYMENT|NOW_REGION)/.test(key) && env[key],
    )
  );
}

/** Reserve one of the ten authorized test sends before contacting Resend.
 * Exclusive files make the cap survive restarts and concurrent workers. A
 * failed/ambiguous provider attempt conservatively consumes its slot. Replays
 * of the same provider idempotency key reuse their reservation. */
export async function reservePureLocalEmail(
  idempotencyKey: string,
): Promise<void> {
  if (!isPureLocalEmailTest()) return;
  const directory = path.join(process.cwd(), ".local", "pure-email-budget");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const identity = createHash("sha256").update(idempotencyKey).digest("hex");
  // The initial, explicitly authorized connection check was sent before this
  // guard was installed. It is permanently part of this ten-message budget.
  try {
    await writeFile(path.join(directory, "01"), "connection-check-20260922", {
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  for (let slot = 2; slot <= PURE_LOCAL_EMAIL_LIMIT; slot++) {
    const file = path.join(directory, String(slot).padStart(2, "0"));
    try {
      if ((await readFile(file, "utf8")) === identity) return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      try {
        await writeFile(file, identity, { flag: "wx", mode: 0o600 });
        return;
      } catch (writeError) {
        if ((writeError as NodeJS.ErrnoException).code !== "EEXIST")
          throw writeError;
        if ((await readFile(file, "utf8")) === identity) return;
      }
    }
  }
  throw new Error("pure_local_email_test_limit_reached");
}

export function assertPureEmailRecipient(
  recipient: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  if (env.PURE_PROFILE !== "pure-dev") return;
  if (
    !isPureLocalEmailTest(env) ||
    recipient.trim().toLowerCase() !==
      env.PURE_LOCAL_EMAIL_RECIPIENT?.trim().toLowerCase()
  ) {
    throw new Error("pure_local_email_recipient_not_allowed");
  }
}
