import type { Metadata } from "next";

import { RentalExperience } from "@/components/RentalExperience";

export const metadata: Metadata = {
  title: "Rental | PURE Osaka",
  description:
    "PURE Osakaの会場レンタル・貸切は20万円から。大阪・心斎橋のクラブのフロア、DJブース、音響照明、バーをまるごと貸し切れます。空き状況とお見積りはCONTACTからご相談ください。",
  alternates: {
    canonical: "/rental",
  },
  openGraph: {
    title: "Rental | PURE Osaka",
    description:
      "心斎橋のフロアを、ひと晩この部屋ごと。会場レンタル・貸切は20万円から。詳細はCONTACTへ。",
    url: "/rental",
  },
};

export default function RentalPage() {
  return <RentalExperience />;
}
