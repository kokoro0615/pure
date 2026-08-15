import type { Metadata } from "next";
import {
  Lora,
  Noto_Sans_JP,
  Open_Sans,
  Playfair_Display,
  Shippori_Mincho,
} from "next/font/google";
import "./globals.css";
import { PureGateLoader } from "@/components/PureGateLoader";

const lora = Lora({ subsets: ["latin"], weight: "400", variable: "--font-lora" });
const openSans = Open_Sans({ subsets: ["latin"], weight: "400", variable: "--font-open-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-playfair" });
// Japanese display face. Migra and Playfair carry no CJK glyphs, so JP
// display copy fell back to a system gothic and broke the pairing.
const shippori = Shippori_Mincho({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-shippori",
  display: "swap",
  preload: false,
});
// Japanese body face. The previous stack named only system fonts
// ("Hiragino Sans", "Yu Gothic", "Noto Sans JP") and loaded none of
// them, so Android and Linux fell through to a generic sans for every
// paragraph of Japanese on the site. Not preloaded: it is body copy,
// never the LCP element.
const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-noto-jp",
  display: "swap",
  preload: false,
});

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
    /* The font variables belong on <html>, not <body>. globals.css composes
       the role tokens (--font-display, --font-meta, --font-jp) at `:root`,
       and a var() inside a custom property resolves against the element it
       is declared on. With the classes on <body>, every one of those role
       tokens was invalid at computed-value time, so `font-family:
       var(--font-meta)` fell back to the inherited body serif and every
       `font: ... var(--font-meta)` shorthand was dropped whole, size and
       weight included. Migra and Univers were loaded and never drawn. */
    <html
      lang="ja"
      className={`${lora.variable} ${openSans.variable} ${playfair.variable} ${shippori.variable} ${notoSansJp.variable}`}
    >
      <body>
        <PureGateLoader />
        {children}
      </body>
    </html>
  );
}
