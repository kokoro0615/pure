import type { Metadata } from "next";

import { VipExperience } from "@/components/VipExperience";

export const metadata: Metadata = {
  title: "VIP Tables | PURE Osaka",
  description:
    "PURE OsakaのVIPセットメニュー。2時間制のPURE SET（¥60,000〜）とBOTTLE SET（¥40,000〜）、ご利用条件とご予約のご案内。",
  alternates: {
    canonical: "/vip",
  },
  openGraph: {
    title: "VIP Tables | PURE Osaka",
    description:
      "シャンパンかボトルか。2時間制のVIPセット6種を、スパークラーと一緒にお席まで。心斎橋 PURE Osaka。",
    url: "/vip",
  },
};

export default function VipPage() {
  return <VipExperience />;
}
