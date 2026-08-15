import type { Metadata } from "next";

import { QaExperience } from "@/components/QaExperience";
import { qaEntries } from "@/lib/qa-data";

export const metadata: Metadata = {
  title: "Q&A | PURE Osaka",
  description:
    "PURE Osakaのよくあるご質問。年齢制限と身分証、営業時間、入場料金のご確認方法、VIPテーブル、アクセス、かかる音楽について。",
  alternates: {
    canonical: "/qa",
  },
  openGraph: {
    title: "Q&A | PURE Osaka",
    description:
      "入る前に、確かめておきたいこと。心斎橋 PURE Osakaのよくあるご質問。",
    url: "/qa",
  },
};

/**
 * Structured data is generated from the same module the page renders, so the
 * markup can never drift from what a guest actually reads on the wall.
 */
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: qaEntries.map((entry) => ({
    "@type": "Question",
    name: entry.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: entry.answer.join(" "),
    },
  })),
};

export default function QaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // The payload is built from a local module, never from user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <QaExperience />
    </>
  );
}
