/** Admission operation only. OTP, login, payment and link lifetimes are independent. */
export const TICKET_ADMISSION_OPERATION_SECONDS = 300;
export const TICKET_ADMISSION_OPERATION_MS = TICKET_ADMISSION_OPERATION_SECONDS * 1_000;

export function ticketAdmissionSchedule(serviceDate: string, lang: "ja" | "en") {
  return lang === "ja"
    ? `${serviceDate} 22:00〜翌05:00 JST`
    : `${serviceDate} 22:00–05:00 the following day (JST)`;
}

export const TICKET_DEMO_ADMISSION_NOTICE = {
  ja: "デモ専用の時間外入場テストです。承認済みの試験期間内は、表示された公演受付時間外も操作できます。実際の入場はできません。",
  en: "Demo-only after-hours check-in test. During the approved test period, check-in can be tested outside the displayed event hours. This does not grant real admission.",
} as const;
