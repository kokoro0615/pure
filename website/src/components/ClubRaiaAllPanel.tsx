"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import styles from "./ClubRaiaAllPanel.module.css";

type NavigationItem = {
  label: string;
  href: string;
  image: string;
};

const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { label: "Home", href: "/", image: "/clubraia/slide06.jpg" },
  {
    label: "The Great Gatsby",
    href: "#the-great-gatsby",
    image: "/clubraia/slide01.jpg",
  },
  { label: "The Suites", href: "#the-suites", image: "/clubraia/slide02.jpg" },
  { label: "Concept", href: "#concept", image: "/clubraia/slide04.jpg" },
  { label: "F&B", href: "#fnb", image: "/clubraia/slide05.jpg" },
  { label: "Events", href: "#events", image: "/clubraia/slide07.jpg" },
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
  const [activePreview, setActivePreview] = useState<number | null>(null);
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
      onPointerLeave={() => setActivePreview(null)}
      onTransitionEnd={(event) => {
        if (
          !isOpen &&
          event.target === event.currentTarget &&
          event.propertyName === "opacity"
        ) {
          setActivePreview(null);
        }
      }}
    >
      <div className={styles.previewStack} aria-hidden="true">
        {NAVIGATION_ITEMS.map((item, index) => (
          <div
            className={`${styles.preview} ${
              isOpen && activePreview === index ? styles.previewIsActive : ""
            }`}
            key={item.image}
          >
            <Image
              src={item.image}
              alt=""
              fill
              sizes="(max-width: 812px) 88vw, 56vw"
              className={styles.previewImage}
            />
          </div>
        ))}
      </div>

      <div className={styles.vignette} aria-hidden="true" />

      <div className={styles.center}>
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
                onMouseEnter={() => setActivePreview(index)}
                onMouseLeave={() => setActivePreview(null)}
                onFocus={() => setActivePreview(index)}
                onBlur={() => setActivePreview(null)}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
