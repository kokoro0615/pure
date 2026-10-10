import { readTicketCommercialSnapshot, ticketOperationalPolicies, TICKET_DRINK_SAFETY, TICKET_TERMS_VERSION } from "../../tickets/ticketCommercialTerms";
import { ticketAdmissionSchedule, TICKET_DEMO_ADMISSION_NOTICE } from "../../tickets/ticketAdmissionTiming";
import type { TransactionalEmailRenderCommand } from "./types";

type Purchase = Extract<TransactionalEmailRenderCommand, { template: "ticket_wallet_purchase" }>;
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
function policyHtml(text: string, lang: "ja" | "en") {
  return escape(text).replace(escape(TICKET_DRINK_SAFETY[lang]), `<strong>${escape(TICKET_DRINK_SAFETY[lang])}</strong>`);
}

/** v1 is deliberately retained in renderer.ts: attempted jobs must render identically. */
export function renderTicketPurchaseNotice(command: Purchase) {
  const wallet = new URL(command.walletUrl);
  const commercial = command.commercial ? readTicketCommercialSnapshot(command.commercial) : undefined;
  if (!command.eventTitle || command.eventTitle.length > 200 || /[\u0000-\u001f]/u.test(command.eventTitle)
    || (commercial && commercial.serviceDate !== command.eventDate)) throw new Error("TRANSACTIONAL_EMAIL_RENDER_INVALID");
  let entry = wallet;
  if (commercial?.admissionPolicy === "order_together_v1") {
    entry = new URL(command.orderEntryUrl ?? "");
    if (entry.origin !== wallet.origin || entry.pathname !== "/tickets/order" || entry.search || entry.username || entry.password
      || !/^#[0-9a-f-]{36}:[A-Za-z0-9._-]{1,64}:[A-Za-z0-9_-]{43}$/u.test(entry.hash)) throw new Error("TRANSACTIONAL_EMAIL_RENDER_INVALID");
  } else if (command.orderEntryUrl) throw new Error("TRANSACTIONAL_EMAIL_RENDER_INVALID");
  const policies = ticketOperationalPolicies(commercial);
  const version = commercial?.version;
  const terms = `${wallet.origin}/tickets/terms${version ? `?version=${encodeURIComponent(version)}` : ""}`;
  const paragraphs = (lang: "ja" | "en") => {
    const ja = lang === "ja";
    const together = commercial?.admissionPolicy === "order_together_v1";
    return [
      together
        ? (ja ? "当日はチケットを開き、全員がそろってから「チェックインに進む」を押してスタッフにご提示ください。スタッフが操作を確定します。準備の有効時間は5分です。受付終了後は入場できません。" : "Open your tickets on arrival. When everyone is present, continue to check-in and show the screen to staff. Staff complete check-in. Preparation is valid for 5 minutes. Check-in closes at the end of admission hours.")
        : (ja ? "当日はMy Ticketsで入場するチケットを選び、入場スワイプを準備してスタッフにご提示ください。スタッフの確認を受けて操作を確定してください。準備の有効時間は5分です。受付終了後は入場できません。" : "On arrival, select the tickets to use in My Tickets, prepare the admission swipe and show staff. Complete the operation after staff confirm. Preparation is valid for 5 minutes. Check-in closes at the end of admission hours."),
      ...(command.demoAdmissionTest ? [TICKET_DEMO_ADMISSION_NOTICE[lang]] : []),
      ...Object.values(policies).map(p => p[lang]),
      ja ? "この注文専用リンクは他の人に転送・共有しないでください。開けない場合やメールを削除した場合は、購入時のメールアドレスでMy Ticketsにログインするか、店舗へご相談ください。" : "Keep this order link private. If it does not open or you delete this email, sign in to My Tickets with your purchase email or ask staff for help.",
      ...(version && version !== TICKET_TERMS_VERSION ? [ja ? "2026年9月14日付で入場・飲み放題の運用案内を訂正しました。購入時の条件は下記リンクで確認できます。" : "Entry and drink-pass guidance was corrected on September 14, 2026. Your original purchase terms remain available below."] : []),
      ja ? "このメールは購入案内です。支払いの領収書ではありません。" : "This purchase notice is not a payment receipt.",
    ];
  };
  const links = (lang: "ja" | "en") => [
    [lang === "ja" ? "My Tickets・チケットの再取得" : "My Tickets · Recover your tickets", wallet.href],
    [lang === "ja" ? `購入時の条件${version ? ` (${version})` : ""}` : `Purchase terms${version ? ` (${version})` : ""}`, terms],
    [lang === "ja" ? "現在のご案内" : "Current information", `${wallet.origin}/tickets/terms`],
    [lang === "ja" ? "販売者" : "Seller", `${wallet.origin}/tickets/legal`],
    [lang === "ja" ? "プライバシーポリシー" : "Privacy", `${wallet.origin}/contact#privacy-policy`],
    [lang === "ja" ? "お問い合わせ（公式Instagram）" : "Contact (official Instagram)", "https://www.instagram.com/pure_osaka/"],
  ];
  const title = (lang: "ja" | "en") => lang === "ja" ? "購入済みチケット" : "Your purchased tickets";
  const cta = (lang: "ja" | "en") => lang === "ja" ? "購入済みチケットを開く" : "Open your purchased tickets";
  const details = (lang: "ja" | "en") => lang === "ja"
    ? [`公演: ${command.eventTitle}`, `入場受付: ${ticketAdmissionSchedule(command.eventDate, lang)}`, `注文番号: ${command.publicCode}`, `券数: ${command.totalQuantity}枚（${command.totalQuantity}名）`]
    : [`Event: ${command.eventTitle}`, `Admission: ${ticketAdmissionSchedule(command.eventDate, lang)}`, `Order: ${command.publicCode}`, `Tickets: ${command.totalQuantity} (${command.totalQuantity} ${command.totalQuantity === 1 ? "guest" : "guests"})`];
  const text = ["PURE Osaka", ...(["ja", "en"] as const).map(lang => [lang === "ja" ? "日本語" : "──────── English ────────", title(lang), ...details(lang), `${cta(lang)}: ${entry.href}`, ...paragraphs(lang), ...links(lang).map(([label, href]) => `${label}: ${href}`)].join("\n\n"))].join("\n\n");
  const sections = (["ja", "en"] as const).map(lang => `<section lang="${lang}"${lang === "en" ? ' style="border-top:2px solid #d5d9de;margin-top:32px;padding-top:24px"' : ""}><h1 style="font-size:24px;line-height:1.4;margin:20px 0 16px">${title(lang)}</h1>${lang === "en" ? '<p style="font-weight:bold">English</p>' : ""}${details(lang).map(d => `<p style="margin:6px 0">${escape(d)}</p>`).join("")}<p style="margin:24px 0"><a href="${escape(entry.href)}" style="display:inline-block;background:#1a1f25;color:#ffffff;padding:14px 20px;text-decoration:none;border-radius:4px;font-weight:bold">${cta(lang)}</a></p>${paragraphs(lang).map(p => `<p style="margin:16px 0">${policyHtml(p, lang)}</p>`).join("")}${links(lang).map(([label, href]) => `<p style="margin:12px 0"><a style="color:#303e51;text-decoration:underline" href="${escape(href)}">${escape(label)}</a></p>`).join("")}</section>`).join("");
  const preheader = `購入済みチケット ${command.totalQuantity}枚 · ${command.eventDate} · Your tickets`;
  return { purpose: "ticket_wallet_purchase" as const, subject: "PURE Osaka 購入済みチケット / Your tickets", text,
    html: `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PURE Osaka</title></head><body style="margin:0;background:#f7f8fa;color:#1a1f25;font-family:Arial,'Hiragino Sans',Meiryo,sans-serif;font-size:15px;line-height:1.7"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escape(preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff"><tr><td style="padding:24px;background:#09060d"><a href="${escape(wallet.origin)}/" style="color:#ffffff"><img src="${escape(wallet.origin)}/pure/purelogo.png" width="180" height="40" alt="PURE Osaka" style="display:block;width:180px;height:40px;border:0"></a></td></tr><tr><td style="padding:24px;overflow-wrap:anywhere"><main>${sections}</main></td></tr></table></td></tr></table></body></html>` };
}
