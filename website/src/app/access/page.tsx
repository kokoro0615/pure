import type { Metadata } from "next";

import { CtaMark } from "@/components/CtaMark";
import { SiteNav } from "@/components/SiteNav";

import styles from "./AccessPage.module.css";

const VENUE_NAME = "PURE OSAKA";
const ADDRESS =
  "大阪府大阪市中央区心斎橋筋2-3-12 ダイヤモンドビルB1F";
const MAP_QUERY = encodeURIComponent(`${VENUE_NAME} ${ADDRESS}`);
const MAP_EMBED_URL = `https://www.google.com/maps?q=${MAP_QUERY}&z=17&output=embed`;
const MAP_DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${MAP_QUERY}`;

export const metadata: Metadata = {
  title: "Access | PURE Osaka",
  description:
    "PURE Osakaへのアクセス。大阪府大阪市中央区心斎橋筋2-3-12 ダイヤモンドビルB1F。Osaka Metroなんば駅14番出口から徒歩約4分。",
  alternates: {
    canonical: "/access",
  },
  openGraph: {
    title: "Access | PURE Osaka",
    description:
      "Osaka Metroなんば駅14番出口から徒歩約4分。PURE Osakaの住所・営業時間・地図をご案内します。",
    url: "/access",
  },
};

export default function AccessPage() {
  return (
    <main className={styles.page}>
      <a className={styles.skipLink} href="#access-title">
        Skip to the details
      </a>
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.glow} aria-hidden="true" />

      <SiteNav />

      <section className={styles.stage} aria-labelledby="access-title">
        <div className={styles.mapPanel}>
          <iframe
            className={styles.map}
            src={MAP_EMBED_URL}
            title="Google Map showing PURE Osaka"
            loading="eager"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <div className={styles.mapWash} aria-hidden="true" />
          <div className={styles.mapGrid} aria-hidden="true" />
        </div>

        <article className={styles.information}>
          <div className={styles.eyebrow}>
            <span>Shinsaibashi, Osaka</span>
          </div>

          <div className={styles.titleBlock}>
            <p>Find the night.</p>
            <h1 id="access-title">
              <span>ACCESS</span>
              <small>PURE OSAKA</small>
            </h1>
          </div>

          <p className={styles.lead} lang="ja">
            なんば駅14番出口から、心斎橋筋を北へ約4分。
            <br />
            ダイヤモンドビル地下1階でお待ちしています。
          </p>

          <dl className={styles.details}>
            <div className={`${styles.detail} ${styles.addressDetail}`}>
              <dt>Address</dt>
              <dd lang="ja">
                大阪府大阪市中央区心斎橋筋2-3-12
                <br />
                ダイヤモンドビル B1F
              </dd>
            </div>
            <div className={styles.detail}>
              <dt>Nearest</dt>
              <dd lang="ja">なんば駅 14番出口 / 徒歩約4分</dd>
            </div>
            <div className={styles.detail}>
              <dt>Open</dt>
              <dd className={styles.numerals}>
                22:00 <span>to</span> 05:00
              </dd>
            </div>
            <div className={styles.detail}>
              <dt>Telephone</dt>
              <dd className={styles.numerals}>
                <a href="tel:+81662146600">06-6214-6600</a>
              </dd>
            </div>
          </dl>

          <div className={styles.actions}>
            <a
              className="pure-cta"
              href={MAP_DIRECTIONS_URL}
              target="_blank"
              rel="noreferrer"
            >
              <span>Get directions</span>
              <CtaMark />
            </a>
            <a className="pure-cta is-ghost" href="tel:+81662146600">
              <span>Call the venue</span>
              <CtaMark />
            </a>
          </div>
        </article>
      </section>
    </main>
  );
}
