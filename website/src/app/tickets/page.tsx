import type { Metadata } from "next";

import { TicketsExperience } from "@/components/TicketsExperience";

export const metadata: Metadata = {
  title: "Tickets | PURE Osaka",
  description:
    "PURE Osakaの入場案内。22:00から翌05:00まで年中無休、心斎橋筋2-3-12 ダイヤモンドビルB1F。通りから受付、フロアまでの流れと、ご来店前の確認事項。",
  alternates: {
    canonical: "/tickets",
  },
  openGraph: {
    title: "Tickets | PURE Osaka",
    description:
      "通りから、フロアまで。心斎橋 PURE Osakaの入口・受付・営業時間のご案内。",
    url: "/tickets",
  },
};

export default function TicketsPage() {
  return <TicketsExperience />;
}
