"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

import styles from "./ClubRaiaInfoPanel.module.css";

export type ClubRaiaInfoPanelKind = "about" | "contact";

export type ClubRaiaInfoPanelProps = {
  panel: ClubRaiaInfoPanelKind;
  isOpen: boolean;
};

type PanelContent = {
  title: string;
  image: string;
  imageAlt: string;
  body: ReactNode;
};

const PANEL_CONTENT: Record<ClubRaiaInfoPanelKind, PanelContent> = {
  about: {
    title: "ABOUT PURE",
    image: "/pure/about/hero-crowd.webp",
    imageAlt:
      "Blue-lit crowd filling the dance floor beneath the PURE Osaka sign",
    body: (
      <>
        <div className={styles.aboutFacts} aria-label="PURE Osaka highlights">
          <span>20+ years in Osaka</span>
          <span>HIPHOP · LATIN · REGGAETON</span>
        </div>
        <p className={styles.aboutStatement}>
          Osaka roots.
          <br />
          Global rhythm.
        </p>
        <p className={styles.aboutCopy} lang="ja">
          {
            "大阪・心斎橋で20年以上。PURE OSAKAは、HIPHOPを軸に、LATIN／REGGAETONまで、音楽と人が国境を越えて交わる夜を育ててきました。ローカルに根ざし、世界へひらかれたフロア。その熱量は、今夜も更新され続けています。"
          }
        </p>
        <p className={styles.aboutCopyEnglish}>
          {
            "For over two decades, PURE OSAKA has kept Shinsaibashi moving—rooted in HIPHOP and charged by LATIN and REGGAETON. Local history. International energy. One floor."
          }
        </p>
        <p className={styles.copyright}>
          © PURE OSAKA. ALL RIGHTS RESERVED.
        </p>
      </>
    ),
  },
  contact: {
    title: "CONTACT",
    image: "/clubraia/contact.jpg",
    imageAlt: "",
    body: (
      <>
        <p className={styles.address}>
          ELYSEE SCBD Jakarta, 5th Floor, RT.7/RW.1, Senayan, Kec. Kby. Baru,
          Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12190
        </p>
        <p className={styles.contactDetails}>
          Email:{" "}
          <a href="mailto:info@clubraia.com">info@clubraia.com</a>
          <br />
          Phone: (021) 50123199
          <br />
          WhatsApp:{" "}
          <a href="https://wa.me/628118691223">+62 811-8691-223</a>
          <br />
          <a
            href="https://goo.gl/maps/nsRxcQkbHRbKsaG29"
            target="_blank"
            rel="noreferrer"
          >
            View on Google Maps
          </a>
        </p>
      </>
    ),
  },
};

function AnimatedTitle({ title }: { title: string }) {
  return (
    <h1 className={styles.title} aria-label={title}>
      {Array.from(title).map((character, index) => (
        <span
          aria-hidden="true"
          className={
            character === " " ? styles.titleSpace : styles.titleCharacter
          }
          key={`${character}-${index}`}
          style={{ "--character-index": index } as CSSProperties}
        >
          {character === " " ? "\u00a0" : character}
        </span>
      ))}
    </h1>
  );
}

export function ClubRaiaInfoPanel({
  panel,
  isOpen,
}: ClubRaiaInfoPanelProps) {
  const content = PANEL_CONTENT[panel];

  return (
    <section
      className={`${styles.panel} ${styles[panel]} ${isOpen ? styles.open : ""}`}
      id={`clubraia-${panel}-panel`}
      role="dialog"
      aria-modal={isOpen ? "true" : undefined}
      aria-hidden={!isOpen}
      inert={!isOpen}
      aria-label={`${content.title} information`}
      data-panel={panel}
      data-open={isOpen ? "true" : "false"}
    >
      <div className={styles.canvas}>
        <div className={styles.imageWrapper}>
          <Image
            className={styles.backgroundImage}
            src={content.image}
            alt={content.imageAlt}
            fill
            sizes="(max-width: 812px) 100vw, 50vw"
          />
        </div>

        <div className={styles.text}>
          <AnimatedTitle title={content.title} />
          <div className={styles.copy}>{content.body}</div>
        </div>
      </div>
    </section>
  );
}
