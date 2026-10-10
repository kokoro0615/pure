import { readTicketCommercialSnapshot, ticketServiceLabel } from "../../tickets/ticketCommercialTerms";
import "server-only";
import { renderTicketPurchaseNotice } from "./ticketPurchaseNotice";
import { isPureLocalEmailTest } from "../pureLocalEmail";

import { createHash } from "node:crypto";

import type {
  RenderedTransactionalEmail,
  TransactionalEmailMessage,
  TransactionalEmailRenderCommand,
  TransactionalEmailTag,
} from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAXIMUM_HEADER_BYTES = 998;
const MAXIMUM_PUBLIC_CODE_BYTES = 128;

export class TransactionalEmailRenderError extends Error {
  constructor() {
    super("TRANSACTIONAL_EMAIL_RENDER_INVALID");
    this.name = "TransactionalEmailRenderError";
  }
}

export function renderTransactionalEmail(
  command: TransactionalEmailRenderCommand,
): RenderedTransactionalEmail {
  validateBaseCommand(command);
  const content = renderLegacyContent(command);
  const testMode = isPureLocalEmailTest();
  const testNote = "ローカル環境の動作確認です。実際の購入・予約ではありません。";
  const tags: readonly TransactionalEmailTag[] = Object.freeze([
    Object.freeze({ name: "purpose" as const, value: content.purpose }),
    Object.freeze({ name: "notification_job_id" as const, value: command.notificationJobId }),
  ]);
  const message: TransactionalEmailMessage = Object.freeze({
    from: command.from,
    recipient: command.recipient,
    replyTo: command.replyTo,
    subject: `${testMode ? "【テスト】" : ""}${content.subject}`,
    text: `${testMode ? `${testNote}\n\n` : ""}${content.text}`,
    html: `${testMode ? `<p>${testNote}</p>` : ""}${"html" in content && typeof content.html === "string" ? content.html : `<p>${escapeHtml(content.text)}</p>`}`,
    tags,
  });
  return Object.freeze({
    templateVersion: command.templateVersion,
    renderReferenceAt: command.renderReferenceAt,
    message,
    payloadHash: hashTransactionalEmailPayload(message),
  });
}

export function hashTransactionalEmailPayload(message: TransactionalEmailMessage) {
  return createHash("sha256")
    .update(canonicalizeTransactionalEmailPayload(message), "utf8")
    .digest("hex");
}

export function canonicalizeTransactionalEmailPayload(message: TransactionalEmailMessage) {
  const base = {
    from: message.from,
    to: [message.recipient],
    subject: message.subject,
    text: message.text,
    html: message.html,
    tags: message.tags.map(({ name, value }) => ({ name, value })),
  };
  return JSON.stringify(message.replyTo === null
    ? base
    : { ...base, reply_to: message.replyTo });
}

function renderLegacyContent(command: TransactionalEmailRenderCommand) {
  if (command.template === "ticket_wallet_purchase") {
    const publicCode = readPublicCode(command.publicCode);
    const walletUrl = readHttpsUrl(command.walletUrl);
    const url = new URL(walletUrl);
    if (url.pathname !== "/tickets/wallet" || url.search || url.hash || !/^\d{4}-\d{2}-\d{2}$/.test(command.eventDate) || !Number.isSafeInteger(command.totalQuantity) || command.totalQuantity < 1 || command.totalQuantity > 20) throw new TransactionalEmailRenderError();
    if (command.templateVersion === "ghost.ticket-wallet-purchase.v2") {
      try { return renderTicketPurchaseNotice(command); }
      catch { throw new TransactionalEmailRenderError(); }
    }
    if (command.commercial) {
      const commercial = readTicketCommercialSnapshot(command.commercial);
      if (commercial.admissionPolicy === "order_together_v1") {
        const entryUrl = new URL(readHttpsUrl(command.orderEntryUrl ?? ""));
        if (entryUrl.origin !== url.origin || entryUrl.pathname !== "/tickets/order" || entryUrl.search
          || !/^#[0-9a-f-]{36}:[A-Za-z0-9._-]{1,64}:[A-Za-z0-9_-]{43}$/u.test(entryUrl.hash)) throw new TransactionalEmailRenderError();
        const text = ["PURE Osaka", `注文番号 / Order: ${publicCode}`, `${ticketServiceLabel(commercial)} / ${command.totalQuantity}名・${command.totalQuantity === 1 ? "ticket" : "tickets"}`,
          `購入済みチケットを開く / Open your purchased tickets: ${entryUrl.href}`,
          "当日はこのリンクからチケットを開き、全員がそろってから「チェックインに進む」を押してスタッフにご提示ください。 / Open this link on arrival. When everyone is present, continue to check-in and show the screen to staff.",
          ...Object.values(commercial.policies).map(p => `${p.ja}\n${p.en}`),
          "この注文専用リンクは他の人に転送・共有しないでください。開けない場合は購入時のメールアドレスでMy Ticketsへログインするか、店舗へご相談ください。 / Keep this order link private. If it does not open, sign in to My Tickets with your purchase email or ask staff for help.",
          `My Tickets: ${walletUrl}`, `購入条件 / Terms (${commercial.version}): ${url.origin}/tickets/terms?version=${encodeURIComponent(commercial.version)}`,
          `販売者 / Seller: ${url.origin}/tickets/legal`, `Privacy: ${url.origin}/contact#privacy-policy`,
          "このメールは購入案内です。支払いの領収書ではありません。 / This purchase notice is not a payment receipt."].join("\n\n");
        return { purpose: "ticket_wallet_purchase", subject: "PURE Osaka 購入済みチケット / Your tickets", text,
          html: `<p><a href="${escapeHtml(entryUrl.href)}">購入済みチケットを開く / Open your purchased tickets</a></p><p>${escapeHtml(text).replaceAll("\n", "<br>")}</p>` } as const;
      }
      if (command.orderEntryUrl) throw new TransactionalEmailRenderError();
      return {
        purpose: "ticket_wallet_purchase",
        subject: "PURE Osaka チケット購入のご案内 / Your tickets",
        text: ["PURE Osaka", `注文番号 / Order: ${publicCode}`, `${ticketServiceLabel(commercial)} / ${command.totalQuantity}名・tickets`,
          `Wallet: ${walletUrl}`, "購入時のメールアドレスで認証してください。入場当日に事前認証してください（有効12時間）。 / Sign in with your purchase email before arrival; entry authentication lasts 12 hours.",
          ...Object.values(commercial.policies).map(p => `${p.ja}\n${p.en}`),
          `購入条件 / Terms (${commercial.version}): ${url.origin}/tickets/terms?version=${encodeURIComponent(commercial.version)}`,
          `販売者 / Seller: ${url.origin}/tickets/legal`, `Privacy: ${url.origin}/contact#privacy-policy`,
          "このメールは購入案内です。支払いの領収書ではありません。 / This purchase notice is not a payment receipt."].join("\n\n"),
      } as const;
    }
    return {
      purpose: "ticket_wallet_purchase",
      subject: "PURE Osaka チケット購入のご案内",
      text: ["PURE Osaka チケット購入のご案内", `注文番号: ${publicCode}`, `営業日: ${command.eventDate} / ${command.totalQuantity}枚`,
        `購入済みチケット: ${walletUrl}`, "購入時のメールアドレスで認証してください。初回は6桁の確認コードを入力します。",
        "入場当日にWalletを開き、事前に認証してください。入場の認証期限は12時間です。",
        "入場操作には通信が必要です。スタッフが確定結果を確認してからご入場ください。再入場はリストバンドをご提示ください。",
        "メールを削除した場合も、同じWalletページからチケットを再取得できます。未着・メール誤入力・端末不調は店舗へご相談ください。",
        "このメールはチケット購入案内です。支払いの領収書ではありません。"].join("\n\n"),
    } as const;
  }
  if (command.template === "ticket_wallet_otp") {
    return renderOtpContent(command);
  }
  const publicCode = readPublicCode(command.publicCode);
  if (command.template === "waitlist_called" || command.template === "waitlist_recalled") {
    return {
      purpose: "waitlist",
      subject: "PURE Osaka ご案内",
      text: `PURE Osakaよりご案内です。30分以内にご来店ください。予約番号: ${publicCode}`,
    } as const;
  }
  if (command.template === "ticket_admission") {
    const ticketAccessUrl = readHttpsUrl(command.ticketAccessUrl);
    return {
      purpose: "ticket",
      subject: "PURE Osaka 入場券",
      text: `PURE Osaka 入場券のお知らせです。注文番号: ${publicCode} / 入場券: ${ticketAccessUrl}`,
    } as const;
  }

  if (command.template === "reservation_created" || command.template === "reservation_changed") {
    const schedule = command.scheduledStartAt
      ? formatReservationSchedule(command.scheduledStartAt)
      : "店舗へお問い合わせください";
    return {
      purpose: "reservation",
      subject: command.template === "reservation_created"
        ? "PURE Osaka VIP予約確認"
        : "PURE Osaka VIP予約変更",
      text: `PURE Osaka VIP予約のお知らせです。予約番号: ${publicCode} / ご来店: ${schedule}`,
    } as const;
  }
  throw new TransactionalEmailRenderError();
}

function renderOtpContent(
  command: Extract<TransactionalEmailRenderCommand, { template: "ticket_wallet_otp" }>,
) {
  if (!/^\d{6}$/u.test(command.otp)) throw new TransactionalEmailRenderError();
  const issuedAt = new Date(command.renderReferenceAt);
  const expiresAt = new Date(command.expiresAt);
  const lifetimeMs = expiresAt.getTime() - issuedAt.getTime();
  if (
    !Number.isFinite(expiresAt.getTime())
    || expiresAt.toISOString() !== command.expiresAt
    // The DB snapshots its own clock; expiry originates in the app request.
    // Preserve the stored deadline and allow only the DB contract's 5s skew.
    || Math.abs(lifetimeMs - 10 * 60 * 1_000) > 5_000
  ) {
    throw new TransactionalEmailRenderError();
  }
  const walletUrl = readHttpsUrl(command.walletUrl);
  const expiration = formatJstTimestamp(expiresAt);
  const subject = "PURE Osaka Ticket Wallet 認証コード";
  const text = [
    "PURE Osaka Ticket Wallet",
    `認証コード: ${command.otp}`,
    `このコードは10分間有効です。有効期限: ${expiration} JST`,
    "PURE Osakaのスタッフが認証コードをお尋ねすることはありません。",
    "心当たりがない場合は、このメールを破棄してください。",
    `Ticket Wallet: ${walletUrl}`,
  ].join("\n\n");
  const html = [
    '<main lang="ja">',
    `<h1>${escapeHtml(subject)}</h1>`,
    '<p>認証コード</p>',
    `<p><code aria-label="6桁の認証コード">${command.otp}</code></p>`,
    `<p>このコードは10分間有効です。<br>有効期限: ${escapeHtml(expiration)} JST</p>`,
    '<p>PURE Osakaのスタッフが認証コードをお尋ねすることはありません。</p>',
    '<p>心当たりがない場合は、このメールを破棄してください。</p>',
    `<p><a href="${escapeHtml(walletUrl)}">Ticket Walletを開く</a></p>`,
    "</main>",
  ].join("");
  return { purpose: "ticket_otp", subject, text, html } as const;
}

function validateBaseCommand(command: TransactionalEmailRenderCommand) {
  readHeaderValue(command.recipient);
  readHeaderValue(command.from);
  if (command.replyTo !== null) readHeaderValue(command.replyTo);
  if (!UUID_PATTERN.test(command.notificationJobId)) throw new TransactionalEmailRenderError();
  const renderReference = new Date(command.renderReferenceAt);
  if (
    !Number.isFinite(renderReference.getTime())
    || renderReference.toISOString() !== command.renderReferenceAt
  ) {
    throw new TransactionalEmailRenderError();
  }
}

function formatReservationSchedule(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TransactionalEmailRenderError();
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function formatJstTimestamp(value: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).format(value);
}

function readHeaderValue(value: string) {
  if (
    typeof value !== "string"
    || value.trim() !== value
    || value.length === 0
    || /[\r\n]/u.test(value)
    || Buffer.byteLength(value, "utf8") > MAXIMUM_HEADER_BYTES
  ) {
    throw new TransactionalEmailRenderError();
  }
  return value;
}

function readPublicCode(value: string) {
  if (
    typeof value !== "string"
    || value.length === 0
    || /[\r\n]/u.test(value)
    || Buffer.byteLength(value, "utf8") > MAXIMUM_PUBLIC_CODE_BYTES
  ) {
    throw new TransactionalEmailRenderError();
  }
  return value;
}

function readHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new TransactionalEmailRenderError();
    }
    return url.toString();
  } catch (error) {
    if (error instanceof TransactionalEmailRenderError) throw error;
    throw new TransactionalEmailRenderError();
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
