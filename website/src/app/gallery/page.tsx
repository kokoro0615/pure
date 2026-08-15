import type { Metadata } from "next";

import { GalleryExperience } from "@/components/GalleryExperience";

export const metadata: Metadata = {
  title: "Gallery | PURE Osaka",
  description:
    "PURE Osakaのフロア、DJ、パフォーマンス、ゲストが交差する夜を収めたフォトギャラリー。心斎橋の熱気を写真でご覧ください。",
  alternates: {
    canonical: "/gallery",
  },
  openGraph: {
    title: "Gallery | PURE Osaka",
    description:
      "音、光、人がひとつになるPURE Osakaの夜。フロアの熱気を写真で体験してください。",
    url: "/gallery",
  },
};

export default function GalleryPage() {
  return <GalleryExperience />;
}
