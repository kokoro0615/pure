"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  type CSSProperties,
} from "react";

import { ArrowUpRight } from "@/components/ArrowUpRight";
import { SOCIAL_LINKS } from "@/components/social";

import styles from "./ClubRaiaAllPanel.module.css";

type NavigationItem = {
  label: string;
  japaneseLabel: string;
  /** Live route, or null while the page is still being written. */
  href: string | null;
  image: string;
  /** Object-position tuned per photograph, per frame ratio. */
  position: string;
  /** Responsive widths for this tile's grid area. */
  sizes: string;
  /** Badge for a room that opens but has nothing to show yet. */
  status?: string;
};

/**
 * Order is hierarchy, and the stylesheet reads it positionally: the grid
 * areas are assigned by :nth-child, so changing this array reorders the
 * composition. Rental sits between Tickets and Q&A because it is the
 * second thing a visitor books after a table, and it carries a badge
 * rather than a null href: the room opens, the terms are not written yet.
 */
const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    label: "Gallery",
    japaneseLabel: "フォトギャラリー",
    href: "/gallery",
    image: "/pure/menu/gallery-floor.webp",
    position: "50% 42%",
    sizes: "(max-width: 1100px) 100vw, 58vw",
  },
  {
    label: "VIP Tables",
    japaneseLabel: "VIPセットメニュー",
    href: "/vip",
    image: "/pure/menu/vip.webp",
    position: "50% 42%",
    sizes: "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 42vw",
  },
  {
    label: "Access",
    japaneseLabel: "営業時間・アクセス",
    href: "/access",
    image: "/pure/menu/access.webp",
    position: "50% 44%",
    sizes: "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 42vw",
  },
  {
    label: "Tickets",
    japaneseLabel: "入場・チケット",
    href: "/tickets",
    image: "/pure/menu/tickets-entrance.webp",
    position: "50% 42%",
    sizes: "(max-width: 1100px) 100vw, 58vw",
  },
  {
    label: "Rental",
    japaneseLabel: "会場レンタル・貸切",
    href: "/rental",
    image: "/pure/menu/rental.webp",
    position: "50% 40%",
    sizes: "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 74vw",
    status: "Coming soon",
  },
  {
    label: "Q&A",
    japaneseLabel: "よくあるご質問",
    href: "/qa",
    image: "/pure/menu/qa-placards.webp",
    position: "50% 46%",
    sizes: "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 26vw",
  },
] as const;

export type ClubRaiaAllPanelProps = {
  isOpen: boolean;
  onNavigate?: (href: string) => void;
  onOpenAbout: () => void;
  onOpenContact: () => void;
};

type TileProps = {
  item: NavigationItem;
};

/** Everything inside a tile except the element that makes it clickable. */
function TileFace({ item }: TileProps) {
  return (
    <>
      <Image
        src={item.image}
        alt=""
        fill
        sizes={item.sizes}
        className={styles.image}
        style={{ objectPosition: item.position }}
      />
      <span className={styles.tint} aria-hidden="true" />
      <span className={styles.scrim} aria-hidden="true" />
      <span className={styles.dim} aria-hidden="true" />
      <span className={styles.copy}>
        <span className={styles.label}>
          {item.label}
          <span className={styles.labelRule} aria-hidden="true" />
        </span>
        <span className={styles.japaneseLabel} lang="ja">
          {item.japaneseLabel}
        </span>
      </span>
    </>
  );
}

/**
 * Full-screen PURE page index. Its close affordance intentionally lives in
 * the parent header, matching the site's single shared close control.
 */
export function ClubRaiaAllPanel({
  isOpen,
  onNavigate,
  onOpenAbout,
  onOpenContact,
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
      <div className={styles.topScrim} aria-hidden="true" />

      <div className={styles.shell}>
        <span className={styles.spine} aria-hidden="true" />

        <div className={styles.intro}>
          <p className={styles.prompt}>Choose your night</p>
        </div>

        {/* The phone header carries one row now, so the two overlays and the
            two accounts are named here instead of squeezed into it. */}
        <nav className={styles.mobileUtilities} aria-label="PURE information">
          <button type="button" onClick={onOpenAbout}>
            About PURE
          </button>
          <button type="button" onClick={onOpenContact}>
            Contact
          </button>
          <a href={SOCIAL_LINKS.youtube} target="_blank" rel="noreferrer">
            YouTube
          </a>
          <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noreferrer">
            Instagram
          </a>
        </nav>

        <ul className={styles.list}>
          {NAVIGATION_ITEMS.map((item, index) => (
            <li
              className={styles.item}
              style={
                {
                  "--item-enter-delay": `${0.28 + index * 0.055}s`,
                  "--item-exit-delay": `${(NAVIGATION_ITEMS.length - 1 - index) * 0.03}s`,
                } as CSSProperties
              }
              key={item.label}
            >
              {item.href === null ? (
                <div className={`${styles.tile} ${styles.isPending}`}>
                  <TileFace item={item} />
                  <span className={styles.status}>Opening soon</span>
                </div>
              ) : (
                <Link
                  className={styles.tile}
                  href={item.href}
                  onClick={() => onNavigate?.(item.href as string)}
                >
                  <TileFace item={item} />
                  {item.status ? (
                    <span className={styles.status}>{item.status}</span>
                  ) : null}
                  <span className={styles.arrow} aria-hidden="true">
                    <ArrowUpRight />
                  </span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
