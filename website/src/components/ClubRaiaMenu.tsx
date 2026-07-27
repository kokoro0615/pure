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
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const isOpen = activePanel !== null;

  const closePanel = useCallback(() => {
    setActivePanel(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
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
    const pageMain = document.querySelector<HTMLElement>("body > main");

    if (isOpen) {
      pageMain?.setAttribute("inert", "");
    } else {
      pageMain?.removeAttribute("inert");
    }

    return () => {
      document.documentElement.classList.remove("clubraia-menu-is-open");
      pageMain?.removeAttribute("inert");
    };
  }, [isOpen]);

  useEffect(() => {
    if (activePanel) {
      window.requestAnimationFrame(() => closeRef.current?.focus());
    }
  }, [activePanel]);

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

      <ClubRaiaAllPanel
        isOpen={activePanel === "all"}
        onNavigate={closePanel}
        onOpenAbout={() => setActivePanel("about")}
        onOpenContact={() => {
          setActivePanel(null);
          onContact();
        }}
      />
      <ClubRaiaInfoPanel panel="about" isOpen={activePanel === "about"} />
      <ClubRaiaInfoPanel panel="contact" isOpen={activePanel === "contact"} />

      <header className={styles.header} aria-label="PURE navigation">
        <div className={styles.headerOverlay} aria-hidden="true" />

        <Link
          className="pure-corner-logo"
          href="/"
          aria-label="PURE Osaka home"
          tabIndex={isOpen ? -1 : 0}
        >
          <Image
            src="/pure/purelogo.png"
            alt="PURE Osaka"
            width={1024}
            height={1024}
            sizes="(max-width: 812px) 58px, 76px"
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
                aria-expanded={
                  panel === "contact" ? undefined : activePanel === panel
                }
                aria-controls={
                  panel === "contact"
                    ? undefined
                    : `clubraia-${panel}-panel`
                }
                aria-haspopup="dialog"
                tabIndex={isOpen ? -1 : 0}
                key={panel}
              >
                <span>{PANEL_LABELS[panel]}</span>
                {panel === "all" ? (
                  <span className={styles.menuIcon} aria-hidden="true">
                    <span />
                    <span />
                  </span>
                ) : null}
              </button>
            ),
          )}

          <button
            ref={closeRef}
            className={`${styles.closeControl} ${
              isOpen ? styles.closeControlActive : ""
            }`}
            type="button"
            onClick={closePanel}
            aria-label={`Close ${
              activePanel ? PANEL_LABELS[activePanel] : "navigation"
            } panel`}
            aria-controls={
              activePanel ? `clubraia-${activePanel}-panel` : undefined
            }
            tabIndex={isOpen ? 0 : -1}
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
        </div>
      </header>
    </>
  );
}
