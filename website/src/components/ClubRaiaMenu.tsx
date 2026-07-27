"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { ClubRaiaAllPanel } from "@/components/ClubRaiaAllPanel";
import { ClubRaiaInfoPanel } from "@/components/ClubRaiaInfoPanel";
import type { ClubRaiaPanel } from "@/types/clubraia-menu";

import styles from "./ClubRaiaMenu.module.css";

const PANEL_LABELS = {
  all: "MENU",
  about: "about",
  contact: "CONTACT",
} as const;

type ClubRaiaMenuProps = {
  onContact: () => void;
};

export function ClubRaiaMenu({ onContact }: ClubRaiaMenuProps) {
  const [activePanel, setActivePanel] = useState<ClubRaiaPanel>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isOpen = activePanel !== null;

  const closePanel = useCallback(() => {
    setActivePanel(null);
    window.setTimeout(() => triggerRef.current?.focus(), 500);
  }, []);

  const openPanel = useCallback(
    (panel: Exclude<ClubRaiaPanel, null>, trigger: HTMLButtonElement) => {
      triggerRef.current = trigger;
      setActivePanel(panel);
    },
    [],
  );

  useEffect(() => {
    document.documentElement.classList.toggle("clubraia-menu-is-open", isOpen);
    return () => document.documentElement.classList.remove("clubraia-menu-is-open");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closePanel, isOpen]);

  return (
    <>
      <div
        className={`${styles.contentOverlay} ${isOpen ? styles.contentOverlayOpen : ""}`}
        aria-hidden="true"
      />

      <ClubRaiaAllPanel isOpen={activePanel === "all"} onNavigate={closePanel} />
      <ClubRaiaInfoPanel panel="about" isOpen={activePanel === "about"} />
      <ClubRaiaInfoPanel panel="contact" isOpen={activePanel === "contact"} />

      <header className={styles.header} aria-label="PURE navigation">
        <div className={styles.headerOverlay} aria-hidden="true" />

        <Link className="pure-corner-logo" href="/" aria-label="PURE Osaka home">
          <Image
            src="/pure/purelogo.png"
            alt="PURE Osaka"
            width={1565}
            height={1005}
            priority
          />
        </Link>

        <div className={styles.controls}>
          {(Object.keys(PANEL_LABELS) as Exclude<ClubRaiaPanel, null>[]).map(
            (panel, index) => (
              <button
                className={`${styles.mainLink} ${styles[`${panel}Link`]} ${
                  isOpen ? styles.mainLinkInactive : ""
                }`}
                style={{ "--link-index": index } as CSSProperties}
                type="button"
                onClick={(event) => {
                  if (panel === "contact") {
                    onContact();
                    return;
                  }

                  openPanel(panel, event.currentTarget);
                }}
                aria-expanded={activePanel === panel}
                aria-controls={`clubraia-${panel}-panel`}
                key={panel}
              >
                {PANEL_LABELS[panel]}
              </button>
            ),
          )}

          {(Object.keys(PANEL_LABELS) as Exclude<ClubRaiaPanel, null>[]).map(
            (panel) => (
              <button
                className={`${styles.closeControl} ${
                  activePanel === panel ? styles.closeControlActive : ""
                }`}
                type="button"
                onClick={closePanel}
                aria-label={`Close ${PANEL_LABELS[panel]} panel`}
                tabIndex={activePanel === panel ? 0 : -1}
                key={`${panel}-close`}
              >
                <span>Close</span>
                <span className={styles.closeLine} aria-hidden="true">
                  <span />
                </span>
                <Image
                  className={styles.closeIcon}
                  src="/clubraia/close.svg"
                  alt=""
                  width={17}
                  height={16}
                />
              </button>
            ),
          )}
        </div>
      </header>
    </>
  );
}
