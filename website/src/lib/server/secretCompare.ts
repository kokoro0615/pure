import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison for shared secrets of arbitrary length.
 *
 * Both sides are hashed to a fixed-length SHA-256 digest before
 * `timingSafeEqual`, so the comparison never leaks the expected length, never
 * throws on mismatched input lengths, and treats empty/missing credentials as
 * non-equal. Nothing about the secret is logged.
 *
 * Leaf module on purpose: no imports beyond node:crypto so any surface
 * (cron, incident contract, worker auth) can share one implementation.
 */
export function safeSecretEqual(
  actual: string | null | undefined,
  expected: string | null | undefined,
) {
  if (typeof actual !== "string" || typeof expected !== "string" || expected.length === 0) {
    return false;
  }

  const actualDigest = createHash("sha256").update(actual, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();

  return timingSafeEqual(actualDigest, expectedDigest);
}
