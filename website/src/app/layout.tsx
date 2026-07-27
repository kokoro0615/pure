import type { Metadata } from "next";
import { Lora, Open_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

const lora = Lora({ subsets: ["latin"], weight: "400", variable: "--font-lora" });
const openSans = Open_Sans({ subsets: ["latin"], weight: "400", variable: "--font-open-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-playfair" });

export const metadata: Metadata = {
  title: "Contact | PURE Osaka",
  description: "Contact PURE Osaka.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${lora.variable} ${openSans.variable} ${playfair.variable}`}>{children}</body>
    </html>
  );
}
