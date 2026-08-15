"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { ClubRaiaMenu } from "@/components/ClubRaiaMenu";
import { CtaMark } from "@/components/CtaMark";
import { TheCrossContact } from "@/components/TheCrossContact";
import {
  galleryAccordions,
  galleryCta,
  galleryGrid,
  galleryHero,
  galleryReel,
  galleryStack,
  type GalleryImage,
} from "@/lib/gallery-data";

import styles from "./GalleryExperience.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * One ordered roll of film. Every section reads its frames out of this
 * array, so the lightbox index is always the frame the visitor clicked.
 */
const FRAMES: readonly GalleryImage[] = [
  galleryHero, // 0  cover
  galleryAccordions[0], // 1  manifesto
  ...galleryStack, // 2..4  the deck
  ...galleryAccordions.slice(1), // 5..7   mosaic
  ...galleryGrid, // 8..13  mosaic
  ...galleryReel, // 14..19 film strip
  galleryCta, // 20 closing
];

const FRAME_COVER = 0;
const FRAME_MANIFESTO = 1;
const DECK = [2, 3, 4];
/** Three unequal columns, mixing orientations so no column reads as a list. */
const MOSAIC_COLUMNS = [
  [7, 8, 10],
  [5, 11, 12],
  [13, 6, 9],
];
const STRIP = [14, 15, 16, 17, 18, 19];
const FRAME_CLOSING = 20;

const MANIFESTO_PHRASES = [
  "Light unravels.",
  "Bass draws near.",
  "A stranger laughs with you, in the same breath.",
  "The night isn't something you watch.",
  "It's something you step into.",
];

const DESKTOP_QUERY = "(min-width: 901px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const frameStyle = (image: GalleryImage) =>
  ({
    "--media-position": image.position,
    "--media-mobile-position": image.mobilePosition,
    "--ratio": image.ratio,
  }) as CSSProperties;

type GalleryFrameProps = {
  index: number;
  sizes: string;
  className?: string;
  priority?: boolean;
  onOpen: (index: number) => void;
};

function GalleryFrame({
  index,
  sizes,
  className = "",
  priority = false,
  onOpen,
}: GalleryFrameProps) {
  const image = FRAMES[index];

  return (
    <button
      className={`${styles.frame} ${className}`}
      type="button"
      onClick={() => onOpen(index)}
      aria-label={`${image.alt}を拡大表示`}
      style={frameStyle(image)}
    >
      <Image
        src={image.src}
        alt={image.alt}
        fill
        priority={priority}
        sizes={sizes}
        className={styles.frameImage}
      />
      <span className={styles.frameShade} aria-hidden="true" />
      <span className={styles.frameCaption}>{image.caption}</span>
      <span className={styles.frameRule} aria-hidden="true" />
    </button>
  );
}

type LightboxProps = {
  selectedIndex: number | null;
  onClose: () => void;
  onSelect: (index: number) => void;
};

function GalleryLightbox({ selectedIndex, onClose, onSelect }: LightboxProps) {
  const lightboxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isOpen = selectedIndex !== null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "ArrowRight") {
        onSelect(((selectedIndex ?? 0) + 1) % FRAMES.length);
      }

      if (event.key === "ArrowLeft") {
        onSelect(((selectedIndex ?? 0) - 1 + FRAMES.length) % FRAMES.length);
      }

      if (event.key === "Tab") {
        const controls = Array.from(
          lightboxRef.current?.querySelectorAll<HTMLButtonElement>(
            "button:not([disabled])",
          ) ?? [],
        );
        const firstControl = controls[0];
        const lastControl = controls.at(-1);

        if (event.shiftKey && document.activeElement === firstControl) {
          event.preventDefault();
          lastControl?.focus();
        } else if (!event.shiftKey && document.activeElement === lastControl) {
          event.preventDefault();
          firstControl?.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, onSelect, selectedIndex]);

  if (!isOpen || selectedIndex === null) {
    return null;
  }

  const image = FRAMES[selectedIndex];

  return (
    <div
      ref={lightboxRef}
      className={styles.lightbox}
      role="dialog"
      aria-modal="true"
      aria-label="Gallery image viewer"
    >
      <div
        className={styles.lightboxBackdrop}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={styles.lightboxStage}>
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="100vw"
          className={styles.lightboxImage}
          style={frameStyle(image)}
          priority
        />
      </div>

      <button
        ref={closeRef}
        className={styles.lightboxClose}
        type="button"
        onClick={onClose}
      >
        <span>Close</span>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m5 5 14 14M19 5 5 19" />
        </svg>
      </button>

      <button
        className={`${styles.lightboxArrow} ${styles.lightboxPrevious}`}
        type="button"
        onClick={() => onSelect((selectedIndex - 1 + FRAMES.length) % FRAMES.length)}
        aria-label="前の写真"
      >
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 12H4M10 6l-6 6 6 6" />
        </svg>
      </button>

      <button
        className={`${styles.lightboxArrow} ${styles.lightboxNext}`}
        type="button"
        onClick={() => onSelect((selectedIndex + 1) % FRAMES.length)}
        aria-label="次の写真"
      >
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 12h16M14 6l6 6-6 6" />
        </svg>
      </button>

      <div className={styles.lightboxCaption}>
        <span>{image.caption}</span>
        <span>
          {String(selectedIndex + 1).padStart(2, "0")} /{" "}
          {String(FRAMES.length).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

export function GalleryExperience() {
  const pageRef = useRef<HTMLElement>(null);
  const spineTickRef = useRef<HTMLSpanElement>(null);
  const stripSectionRef = useRef<HTMLElement>(null);
  const stripViewportRef = useRef<HTMLDivElement>(null);
  const stripTrackRef = useRef<HTMLDivElement>(null);
  const stripPanRef = useRef({ pinned: false, step: 0 });
  const lightboxTriggerRef = useRef<HTMLElement | null>(null);

  const [isContactOpen, setIsContactOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const openFrame = useCallback((index: number) => {
    if (document.activeElement instanceof HTMLElement) {
      lightboxTriggerRef.current = document.activeElement;
    }

    setSelectedIndex(index);
  }, []);

  const closeFrame = useCallback(() => {
    setSelectedIndex(null);
    window.requestAnimationFrame(() => lightboxTriggerRef.current?.focus());
  }, []);

  const openContact = useCallback(() => setIsContactOpen(true), []);
  const closeContact = useCallback(() => setIsContactOpen(false), []);

  useEffect(() => {
    const page = pageRef.current;
    const navigation = document.querySelector<HTMLElement>(
      'header[aria-label="PURE navigation"]',
    );
    const isLightboxOpen = selectedIndex !== null;

    document.documentElement.classList.toggle(
      "gallery-modal-is-open",
      isLightboxOpen,
    );

    if (isLightboxOpen) {
      page?.setAttribute("inert", "");
      navigation?.setAttribute("inert", "");
    } else {
      page?.removeAttribute("inert");
      navigation?.removeAttribute("inert");
    }

    return () => {
      document.documentElement.classList.remove("gallery-modal-is-open");
      page?.removeAttribute("inert");
      navigation?.removeAttribute("inert");
    };
  }, [selectedIndex]);

  useGSAP(
    () => {
      const page = pageRef.current;
      const tick = spineTickRef.current;

      if (!page) {
        return;
      }

      const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
      const isDesktop = window.matchMedia(DESKTOP_QUERY).matches;

      /* Scroll position on the spine. Transform only, no layout work. */
      if (tick) {
        const setProgress = gsap.quickSetter(tick, "scaleY");
        ScrollTrigger.create({
          scroller: page,
          start: 0,
          end: "max",
          onUpdate: (self) => setProgress(Math.max(self.progress, 0.02)),
        });
      }

      /* The film strip pans sideways while the section is pinned. This is
         the one signature move on the page; everything else stays quiet. */
      const section = stripSectionRef.current;
      const viewport = stripViewportRef.current;
      const track = stripTrackRef.current;

      if (section && viewport && track && isDesktop && !reduceMotion) {
        viewport.classList.remove(styles.stripScroll);
        stripPanRef.current.pinned = true;

        const distance = () => Math.max(track.scrollWidth - viewport.clientWidth, 0);

        gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: section,
            scroller: page,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onRefresh: () => {
              const frame = track.firstElementChild as HTMLElement | null;
              stripPanRef.current.step = frame ? frame.offsetWidth + 24 : 480;
            },
          },
        });
      }

      if (reduceMotion) {
        ScrollTrigger.refresh();
        return;
      }

      /* Cover: the photograph settles while the title rises out of its mask. */
      gsap
        .timeline({ defaults: { ease: "expo.out" } })
        .fromTo(
          `.${styles.heroImage}`,
          { scale: 1.1 },
          { scale: 1, duration: 1.9 },
        )
        .fromTo(
          `.${styles.heroWord}`,
          { yPercent: 108 },
          { yPercent: 0, duration: 1.15, stagger: 0.1 },
          0.16,
        );

      /* Manifesto: four phrases develop like a print in the tray. */
      gsap.fromTo(
        `.${styles.manifestoPhrase}`,
        { opacity: 0.24, y: 14 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.5,
          ease: "none",
          scrollTrigger: {
            trigger: `.${styles.manifestoBody}`,
            scroller: page,
            start: "top 78%",
            end: "bottom 62%",
            scrub: 0.8,
          },
        },
      );

      /* The deck: each frame sticks, then the next one lands on top of it. */
      if (isDesktop) {
        const deck = gsap.utils.toArray<HTMLElement>(`.${styles.stackFrame}`);
        deck.forEach((frame, index) => {
          const next = deck[index + 1];

          if (!next) {
            return;
          }

          /* Compositor-only properties, and explicit from-values so GSAP
             never has to guess a start state. */
          gsap.fromTo(
            frame,
            { scale: 1, opacity: 1 },
            {
              scale: 0.93,
              opacity: 0.42,
              ease: "none",
              scrollTrigger: {
                trigger: next,
                scroller: page,
                start: "top bottom",
                end: "top top",
                scrub: true,
              },
            },
          );
        });
      }

      /* Mosaic frames rise as they enter. One group per viewport. */
      gsap.utils
        .toArray<HTMLElement>(`.${styles.mosaicReveal}`)
        .forEach((frame) => {
          gsap.fromTo(
            frame,
            { opacity: 0, y: 46 },
            {
              opacity: 1,
              y: 0,
              duration: 0.9,
              ease: "power3.out",
              scrollTrigger: {
                trigger: frame,
                scroller: page,
                start: "top 92%",
                once: true,
              },
            },
          );
        });

      /* Photographs and webfonts settle after first paint, and every pixel
         they add above a trigger moves that trigger. Re-measure instead of
         trusting the first layout. */
      void document.fonts?.ready.then(() => ScrollTrigger.refresh());

      let refreshTimer = 0;
      const refresh = () => {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 200);
      };

      const observer = new ResizeObserver(refresh);
      observer.observe(page.firstElementChild ?? page);
      gsap.utils
        .toArray<HTMLElement>(`.${styles.mosaicColumns}`)
        .forEach((node) => observer.observe(node));

      return () => {
        window.clearTimeout(refreshTimer);
        observer.disconnect();
      };
    },
    { scope: pageRef },
  );

  const panStrip = useCallback((direction: -1 | 1) => {
    const { pinned, step } = stripPanRef.current;

    if (pinned) {
      pageRef.current?.scrollBy({
        top: direction * (step || 480),
        behavior: "smooth",
      });
      return;
    }

    stripViewportRef.current?.scrollBy({
      left: direction * Math.min(window.innerWidth * 0.74, 720),
      behavior: "smooth",
    });
  }, []);

  return (
    <>
      <main ref={pageRef} className={styles.page}>
        <a className={styles.skipLink} href="#mosaic">
          Skip to the photographs
        </a>
        <div className={styles.grain} aria-hidden="true" />
        <div className={styles.navScrim} aria-hidden="true" />
        <div className={styles.spine} aria-hidden="true">
          <span ref={spineTickRef} className={styles.spineTick} />
        </div>
        <section className={styles.hero} aria-labelledby="gallery-title">
          <div className={styles.heroMedia}>
            <Image
              src={FRAMES[FRAME_COVER].src}
              alt={FRAMES[FRAME_COVER].alt}
              fill
              priority
              sizes="100vw"
              className={styles.heroImage}
              style={frameStyle(FRAMES[FRAME_COVER])}
            />
            <div className={styles.heroWash} aria-hidden="true" />
          </div>

          <h1 id="gallery-title" className={styles.heroTitle}>
            <span className={styles.heroLine}>
              <span className={styles.heroWord}>The night</span>
            </span>
            <span className={styles.heroLine}>
              <span className={styles.heroWord}>is PURE</span>
            </span>
          </h1>

        </section>

        <section className={styles.manifesto} aria-label="Gallery introduction">
          <p className={styles.manifestoBody}>
            {MANIFESTO_PHRASES.map((phrase) => (
              <span className={styles.manifestoPhrase} key={phrase}>
                {phrase}
              </span>
            ))}
          </p>
          <div className={styles.manifestoFrame}>
            <GalleryFrame
              index={FRAME_MANIFESTO}
              sizes="(max-width: 760px) 92vw, (max-width: 1080px) 62vw, 34vw"
              onOpen={openFrame}
            />
          </div>
        </section>

        <section className={styles.stack} aria-labelledby="deck-title">
          <div className={`${styles.head} ${styles.stackHead}`}>
            <h2 id="deck-title">
              People.
              <br />
              Sound.
              <br />
              Light.
            </h2>
          </div>

          <div className={styles.stackDeck}>
            {DECK.map((index) => (
              <GalleryFrame
                index={index}
                className={styles.stackFrame}
                sizes="(max-width: 1080px) 92vw, 58vw"
                onOpen={openFrame}
                key={FRAMES[index].src}
              />
            ))}
          </div>
        </section>

        <section id="mosaic" className={styles.mosaic} aria-labelledby="mosaic-title">
          <div className={`${styles.head} ${styles.mosaicHead}`}>
            <h2 id="mosaic-title">
              Close enough
              <br />
              to feel it.
            </h2>
          </div>

          <div className={styles.mosaicColumns}>
            {MOSAIC_COLUMNS.map((column) => (
              <div className={styles.mosaicColumn} key={FRAMES[column[0]].src}>
                {column.map((index) => (
                  <GalleryFrame
                    index={index}
                    className={styles.mosaicReveal}
                    sizes="(max-width: 760px) 92vw, (max-width: 1080px) 46vw, 31vw"
                    onOpen={openFrame}
                    key={FRAMES[index].src}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>

        <section
          ref={stripSectionRef}
          className={styles.strip}
          aria-labelledby="strip-title"
        >
          <div className={styles.stripHead}>
            <h2 id="strip-title">The night keeps moving.</h2>
            <div className={styles.stripControls}>
              <button
                className={styles.stripButton}
                type="button"
                onClick={() => panStrip(-1)}
                aria-label="前の写真へ"
              >
                <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M20 12H4M10 6l-6 6 6 6" />
                </svg>
              </button>
              <button
                className={styles.stripButton}
                type="button"
                onClick={() => panStrip(1)}
                aria-label="次の写真へ"
              >
                <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 12h16M14 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>

          <div
            ref={stripViewportRef}
            className={`${styles.stripViewport} ${styles.stripScroll}`}
          >
            <div ref={stripTrackRef} className={styles.stripTrack}>
              {STRIP.map((index) => (
                <GalleryFrame
                  index={index}
                  className={styles.stripFrame}
                  sizes="(max-width: 760px) 78vw, 44vw"
                  onOpen={openFrame}
                  key={FRAMES[index].src}
                />
              ))}
            </div>
          </div>
        </section>

        <section className={styles.cta} aria-labelledby="cta-title">
          <Image
            src={FRAMES[FRAME_CLOSING].src}
            alt={FRAMES[FRAME_CLOSING].alt}
            fill
            sizes="100vw"
            className={styles.ctaImage}
            style={frameStyle(FRAMES[FRAME_CLOSING])}
          />
          <div className={styles.ctaWash} aria-hidden="true" />

          <div className={styles.ctaContent}>
            <h2 id="cta-title">
              Don&apos;t just
              <br />
              watch the night.
            </h2>
            <div className={styles.ctaActions}>
              <Link className="pure-cta" href="/access">
                <span>Plan your visit</span>
                <CtaMark />
              </Link>
              <button className="pure-cta is-ghost" type="button" onClick={openContact}>
                <span>VIP &amp; Contact</span>
                <CtaMark />
              </button>
            </div>
          </div>

          <footer className={styles.footer}>
            <span>PURE OSAKA</span>
            <Link href="/access">Shinsaibashi / Osaka</Link>
            <span>© {new Date().getFullYear()}</span>
          </footer>
        </section>
      </main>

      <ClubRaiaMenu isContactOpen={isContactOpen} onContact={openContact} />
      {isContactOpen ? <TheCrossContact onClose={closeContact} /> : null}
      <GalleryLightbox
        selectedIndex={selectedIndex}
        onClose={closeFrame}
        onSelect={setSelectedIndex}
      />
    </>
  );
}
