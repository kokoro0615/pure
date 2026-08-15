"use client";

import Image from "next/image";
import Link from "next/link";

import { CtaMark } from "@/components/CtaMark";

import styles from "./ClubRaiaInfoPanel.module.css";

export type ClubRaiaInfoPanelKind = "about";

export type ClubRaiaInfoPanelProps = {
  panel: ClubRaiaInfoPanelKind;
  isOpen: boolean;
};

/**
 * ABOUT PURE.
 *
 * What was here before was the generated-web house style, top to bottom: a
 * Playfair title letterspaced to 24px and centred, a chip row of facts in a
 * blue that exists nowhere else on the site, a two-word parallel slogan
 * ("Osaka roots. / Global rhythm."), the Japanese paragraph, then the same
 * paragraph again in English, then a copyright line in the middle of the
 * composition. The photograph behind all of it was dimmed to 38% and used as
 * wallpaper. Every one of those is a default, not a decision.
 *
 * This is the venue instead: a real photograph of the floor at full strength,
 * a Migra headline naming the actual place (one basement in Shinsaibashi),
 * the client's own Japanese copy in the site's Japanese faces, and the
 * verified facts as a ruled record rather than as decoration. Nothing is
 * asserted here that the site does not already publish elsewhere.
 */

/** Only what /access, /tickets and the venue's own pages already state. */
const RECORD = [
  { label: "Since", value: "20年以上、大阪・心斎橋", lang: "ja" },
  { label: "Floor", value: "ダイヤモンドビル B1F", lang: "ja" },
  { label: "Sound", value: "HIPHOP · LATIN · REGGAETON" },
  { label: "Doors", value: "22:00 — 05:00", numeric: true },
] as const;

export function ClubRaiaInfoPanel({ isOpen }: ClubRaiaInfoPanelProps) {
  return (
    <section
      className={`${styles.panel} ${isOpen ? styles.open : ""}`}
      id="clubraia-about-panel"
      role="dialog"
      aria-modal={isOpen ? "true" : undefined}
      aria-hidden={!isOpen}
      inert={!isOpen}
      aria-labelledby="clubraia-about-title"
      data-panel="about"
      data-open={isOpen ? "true" : "false"}
    >
      <div className={styles.canvas}>
        <figure className={styles.plate}>
          <Image
            className={styles.plateImage}
            src="/pure/about/hero-crowd.webp"
            alt="Blue-lit crowd filling the dance floor beneath the PURE Osaka sign"
            fill
            sizes="(max-width: 812px) 100vw, 46vw"
          />
          <span className={styles.plateEdge} aria-hidden="true" />
          <figcaption className={styles.plateCaption}>
            Shinsaibashi, B1F
          </figcaption>
        </figure>

        <div className={styles.text}>
          <h2 className={styles.title} id="clubraia-about-title">
            <span>
              <span>One basement</span>
            </span>
            <span>
              <span>in Shinsaibashi</span>
            </span>
          </h2>

          <p className={styles.statement} lang="ja">
            20年以上、この一枚のフロアで。
          </p>

          <p className={styles.body} lang="ja">
            大阪・心斎橋で20年以上。PURE
            OSAKAは、HIPHOPを軸に、LATIN／REGGAETONまで、音楽と人が国境を越えて交わる夜を育ててきました。ローカルに根ざし、世界へひらかれたフロア。その熱量は、今夜も更新され続けています。
          </p>

          <dl className={styles.record}>
            {RECORD.map((row) => (
              <div className={styles.recordRow} key={row.label}>
                <dt>{row.label}</dt>
                <dd
                  className={
                    "numeric" in row && row.numeric ? styles.numeric : undefined
                  }
                  lang={"lang" in row ? row.lang : undefined}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <Link className={`pure-cta is-ghost ${styles.action}`} href="/access">
            <span>Find the venue</span>
            <CtaMark />
          </Link>
        </div>
      </div>
    </section>
  );
}
