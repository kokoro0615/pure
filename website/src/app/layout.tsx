import type { Metadata } from "next";
import { Lora, Open_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

const lora = Lora({ subsets: ["latin"], weight: "400", variable: "--font-lora" });
const openSans = Open_Sans({ subsets: ["latin"], weight: "400", variable: "--font-open-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-playfair" });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.club-pure.com"),
  title: "PURE Osaka | Premium Nightlife in Shinsaibashi",
  description:
    "大阪・心斎橋のナイトクラブ PURE Osaka。HIPHOP、LATIN、REGGAETONが交わるプレミアムなナイトライフをお楽しみください。",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "/",
    siteName: "PURE Osaka",
    title: "PURE Osaka | Premium Nightlife in Shinsaibashi",
    description:
      "大阪・心斎橋で20年以上。音楽と人が国境を越えて交わる、PURE Osakaのプレミアムナイトライフ。",
  },
  twitter: {
    card: "summary_large_image",
    title: "PURE Osaka | Premium Nightlife in Shinsaibashi",
    description:
      "大阪・心斎橋で20年以上。音楽と人が国境を越えて交わる、PURE Osakaのプレミアムナイトライフ。",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${lora.variable} ${openSans.variable} ${playfair.variable}`}>{children}</body>
    </html>
  );
}
