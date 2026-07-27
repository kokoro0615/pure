"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  type CSSProperties,
} from "react";

import styles from "./ClubRaiaAllPanel.module.css";

type NavigationItem = {
  label: string;
  detail: string;
  japaneseLabel: string;
  href: string;
  image: string;
  position?: string;
};

const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    label: "Events",
    detail: "Upcoming nights",
    japaneseLabel: "今後のイベント",
    href: "#events",
    image: "/pure/menu/events.webp",
    position: "50% 42%",
  },
  {
    label: "Lineup",
    detail: "DJs & performers",
    japaneseLabel: "出演者",
    href: "#lineup",
    image: "/pure/menu/lineup.webp",
    position: "50% 38%",
  },
  {
    label: "VIP Tables",
    detail: "Bottle service",
    japaneseLabel: "VIP予約",
    href: "#vip",
    image: "/pure/menu/vip.webp",
    position: "50% 46%",
  },
  {
    label: "System",
    detail: "Entry & dress code",
    japaneseLabel: "入場案内",
    href: "#system",
    image: "/pure/menu/system.webp",
    position: "52% 50%",
  },
  {
    label: "Gallery",
    detail: "After dark",
    japaneseLabel: "フォトギャラリー",
    href: "#gallery",
    image: "/pure/menu/gallery-night-v2.webp",
    position: "50% 38%",
  },
  {
    label: "Access",
    detail: "Hours & location",
    japaneseLabel: "営業時間・アクセス",
    href: "#access",
    image: "/pure/menu/access.webp",
    position: "50% 40%",
  },
] as const;

export type ClubRaiaAllPanelProps = {
  isOpen: boolean;
  onNavigate?: (href: string) => void;
};

/**
 * Full-screen Club Raia page index. Its close affordance intentionally lives in
 * the parent header, matching the source site's single shared close control.
 */
export function ClubRaiaAllPanel({
  isOpen,
  onNavigate,
}: ClubRaiaAllPanelProps) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isOpen) {
      panelRef.current?.scrollTo({ top: 0 });
    }
  }, [isOpen]);

  return (
    <section
      ref={panelRef}
      className={`${styles.panel} ${isOpen ? styles.isOpen : styles.isClosed}`}
      id="clubraia-all-panel"
      role="dialog"
      aria-label="All pages"
      aria-modal={isOpen ? "true" : undefined}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <div className={styles.atmosphere} aria-hidden="true" />

      <div className={styles.shell}>
        <div className={styles.intro}>
          <p className={styles.kicker}>PURE OSAKA / NIGHT DIRECTORY</p>
          <p className={styles.prompt}>Choose your night</p>
          <span className={styles.count}>06 destinations</span>
        </div>

        <ul className={styles.list}>
          {NAVIGATION_ITEMS.map((item, index) => (
            <li
              className={styles.item}
              style={
                {
                  "--item-enter-delay": `${0.6 + index * 0.08}s`,
                  "--item-exit-delay": `${(NAVIGATION_ITEMS.length - 1 - index) * 0.03}s`,
                } as CSSProperties
              }
              key={item.label}
            >
              <a
                className={styles.link}
                href={item.href}
                onClick={() => onNavigate?.(item.href)}
              >
                <Image
                  src={item.image}
                  alt=""
                  fill
                  sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 42vw"
                  className={styles.image}
                  style={{ objectPosition: item.position }}
                />
                <span className={styles.imageWash} aria-hidden="true" />
                <span className={styles.index} aria-hidden="true">
                  {(index + 1).toString().padStart(2, "0")}
                </span>
                <span className={styles.copy}>
                  <span className={styles.detail}>{item.detail}</span>
                  <span className={styles.label}>{item.label}</span>
                  <span className={styles.japaneseLabel}>
                    {item.japaneseLabel}
                  </span>
                </span>
                <span className={styles.arrow} aria-hidden="true">
                  <span>↗</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
