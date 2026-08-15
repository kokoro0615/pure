"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { ClubRaiaAllPanel } from "@/components/ClubRaiaAllPanel";
import { ClubRaiaInfoPanel } from "@/components/ClubRaiaInfoPanel";
import {
  InstagramIcon,
  SOCIAL_LINKS,
  YoutubeIcon,
} from "@/components/social";
import type { ClubRaiaPanel } from "@/types/clubraia-menu";

import styles from "./ClubRaiaMenu.module.css";

/* HOME leads the row: it is the only entry that is a place rather than an
   overlay, and a visitor two rooms deep had no labelled way back to the
   front door except the corner mark. The three that follow open over the
   page, so they stay buttons. */
const PANEL_LABELS = {
  all: "MENU",
  about: "ABOUT",
  contact: "CONTACT",
} as const;

/** Index 0 belongs to HOME; the panels stagger in behind it. */
const PANEL_INDEX_OFFSET = 1;

type ClubRaiaMenuProps = {
  isContactOpen: boolean;
  onContact: () => void;
};

export function ClubRaiaMenu({
  isContactOpen,
  onContact,
}: ClubRaiaMenuProps) {
  const pathname = usePathname();
  const [activePanel, setActivePanel] = useState<ClubRaiaPanel>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const isPanelOpen = activePanel !== null;
  const isOpen = isPanelOpen || isContactOpen;

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
    if (!isPanelOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closePanel, isPanelOpen]);

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
          <nav className={styles.primaryNavigation} aria-label="Primary navigation">
            <Link
              className={`${styles.mainLink} ${
                isOpen ? styles.mainLinkInactive : ""
              }`}
              style={{ "--link-index": 0 } as CSSProperties}
              href="/"
              aria-current={pathname === "/" ? "page" : undefined}
              tabIndex={isOpen ? -1 : 0}
            >
              <span>HOME</span>
            </Link>

            {(Object.keys(PANEL_LABELS) as Exclude<ClubRaiaPanel, null>[]).map(
              (panel, index) => (
                <button
                  className={`${styles.mainLink} ${
                    panel === "about" ? styles.mainLinkDesk : ""
                  } ${isOpen ? styles.mainLinkInactive : ""}`}
                  style={
                    {
                      "--link-index": index + PANEL_INDEX_OFFSET,
                    } as CSSProperties
                  }
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
                </button>
              ),
            )}
          </nav>

          <nav
            className={`${styles.socialLinks} ${
              isOpen ? styles.socialLinksInactive : ""
            }`}
            aria-label="Follow PURE Osaka"
          >
            <span className={styles.socialLabel} aria-hidden="true">
              Follow
            </span>
            <a
              className={`${styles.socialLink} ${
                isOpen ? styles.socialLinkInactive : ""
              }`}
              style={{ "--link-index": 4 } as CSSProperties}
              href={SOCIAL_LINKS.youtube}
              target="_blank"
              rel="noreferrer"
              aria-label="PURE Osaka on YouTube"
              tabIndex={isOpen ? -1 : 0}
            >
              <YoutubeIcon />
            </a>
            <a
              className={`${styles.socialLink} ${
                isOpen ? styles.socialLinkInactive : ""
              }`}
              style={{ "--link-index": 5 } as CSSProperties}
              href={SOCIAL_LINKS.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label="PURE Osaka on Instagram"
              tabIndex={isOpen ? -1 : 0}
            >
              <InstagramIcon />
            </a>
          </nav>

          <button
            ref={closeRef}
            className={`${styles.closeControl} ${
              isPanelOpen ? styles.closeControlActive : ""
            }`}
            type="button"
            onClick={closePanel}
            aria-label={`Close ${
              activePanel ? PANEL_LABELS[activePanel] : "navigation"
            } panel`}
            aria-controls={
              activePanel ? `clubraia-${activePanel}-panel` : undefined
            }
            tabIndex={isPanelOpen ? 0 : -1}
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
