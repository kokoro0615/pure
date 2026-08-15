import type { Metadata } from "next";

import { RentalComingSoon } from "@/components/RentalComingSoon";

export const metadata: Metadata = {
  title: "Rental | PURE Osaka",
  description:
    "PURE Osakaの会場レンタル・貸切のご案内は準備中です。大阪・心斎橋のクラブでのイベントや貸切のご相談はお問い合わせフォームまたはお電話で承ります。",
  alternates: {
    canonical: "/rental",
  },
  openGraph: {
    title: "Rental | PURE Osaka",
    description:
      "会場レンタル・貸切のご案内は準備中です。イベントや貸切のご相談は PURE Osaka までお問い合わせください。",
    url: "/rental",
  },
};

export default function RentalPage() {
  return <RentalComingSoon />;
}
