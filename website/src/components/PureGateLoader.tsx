"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./PureGateLoader.module.css";

/**
 * The entry veil, and the only thing between arriving and the site.
 *
 * Three beats. A ring draws the real load progress while the mark ignites
 * inside it and the venue's address settles onto the ring's own arc. The mark
 * holds, lit. Then the ground splits: two carbon leaves travel off the top and
 * bottom of the screen, cutting the ring in half as they go, while the mark
 * survives whole and flies to the corner logo it becomes — so the site is
 * revealed by a door opening, and the arrival is one continuous move from the
 * street into the room rather than a screen that fades and another that
 * appears.
 *
 * It plays on every document load by request. Client-side route changes keep
 * the layout mounted, so moving between pages inside the site does not replay
 * it; a reload does.
 */

/** Time the arc takes to reach its holding value. */
const FILL_MS = 1250;
/** Where the arc waits for the page: short of full, never pretending. */
const HOLD_AT = 0.92;
/** Floor on the sequence. This is the dial that sets how long the arrival
 *  feels: a warm cache would otherwise close the arc almost immediately. */
const MIN_HOLD_MS = 1250;
/** Ramp from the holding value to a closed ring once the page is ready. */
const COMPLETE_MS = 340;
/** The beat where the mark sits lit before the door opens. Long enough for
 *  the ignition to finish: cut it shorter and the mark leaves while it is
 *  still coming on, which is the one moment the sequence exists for. */
const LIT_HOLD_MS = 430;
/** The door travel plus the flight. Matches the longest CSS duration here
 *  (the leaves at 940ms, plus their 40ms stagger). */
const EXIT_MS = 1000;
/** Nothing here waits on the network longer than this. */
const MAX_WAIT_MS = 4200;
/** Reduced motion: hold the resolved composition, then fade the leaves. */
const REDUCED_HOLD_MS = 900;

type Phase = "boot" | "lit" | "exit" | "done";

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The translate+scale that lands the mark exactly on the corner logo.
 *
 * Both elements frame the artwork with the same crop box (623x699, shared with
 * `.pure-corner-logo` in globals.css and cut by `scripts/build-pure-mark.mjs`),
 * so matching their centres and widths is enough: no distortion, no drift.
 * Returns null when the corner logo is absent or unmeasured, and the mark then
 * settles in place instead.
 */
function measureFlight(mark: HTMLElement): string | null {
  const corner = document.querySelector<HTMLElement>(".pure-corner-logo");

  if (!corner) {
    return null;
  }

  const from = mark.getBoundingClientRect();
  const to = corner.getBoundingClientRect();

  if (from.width === 0 || to.width === 0) {
    return null;
  }

  const scale = to.width / from.width;
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);

  return `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
}

/**
 * The ring: a hairline track, the determinate arc, and — in the lower half
 * only — the venue's name set on the arc itself.
 *
 * The arc is rotated by attribute rather than by CSS so it starts at twelve
 * o'clock in every engine, and the text path is rendered once (in the lower
 * copy) because two copies would mean two elements sharing one id.
 */
function GateRing({ withWordmark = false }: { withWordmark?: boolean }) {
  return (
    <svg
      className={styles.ring}
      viewBox="0 0 200 200"
      aria-hidden="true"
      focusable="false"
    >
      <circle className={styles.ringTrack} cx="100" cy="100" r="94" />
      <circle
        className={styles.ringArc}
        cx="100"
        cy="100"
        r="94"
        transform="rotate(-90 100 100)"
      />

      {withWordmark ? (
        <>
          {/* Left to right through the bottom of the circle, so the glyphs
              stand upright and read inward. */}
          <path
            id="pure-gate-seal-arc"
            d="M 28 100 A 72 72 0 0 0 172 100"
            fill="none"
          />
          <text className={styles.ringWord} textAnchor="middle">
            {/* The place, not the name. The mark in the middle already
                reads PURE OSAKA; repeating it on the arc would be the same
                word twice inside one circle. */}
            <textPath href="#pure-gate-seal-arc" startOffset="50%">
              Shinsaibashi, Osaka
            </textPath>
          </text>
        </>
      ) : null}
    </svg>
  );
}

export function PureGateLoader() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [flight, setFlight] = useState<string | null>(null);

  const veilRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);

  const startExit = useCallback(() => {
    const veil = veilRef.current;
    const mark = markRef.current;

    /* Close the ring before the door opens. Skipping mid-sweep should look
       like the arrival completing early, not like it was cut off. */
    veil?.style.setProperty("--p", "1");

    /* The flight is an inline transform, so it would win over the authored
       still state in CSS. Under reduced motion it is never measured at all
       and the mark stays put while the leaves fade. */
    if (mark && !prefersReducedMotion()) {
      setFlight(measureFlight(mark));
    }

    setPhase("exit");
  }, []);

  /* The whole timeline. Progress is written straight to a custom property from
     rAF: a continuous value driven through React state would re-render the
     tree sixty times a second for one stroke offset. */
  useEffect(() => {
    const veil = veilRef.current;

    if (!veil) {
      return;
    }

    const timers: number[] = [];
    const reduced = prefersReducedMotion();

    if (reduced) {
      /* No sweep and no flight. CSS draws the ring closed and the mark lit;
         all that is left is to hold the resolved composition, then leave. */
      timers.push(
        window.setTimeout(startExit, REDUCED_HOLD_MS),
      );
      return () => timers.forEach(window.clearTimeout);
    }

    const start = performance.now();
    let frame = 0;
    let readyAt: number | null = null;
    let progressAtReady = 0;

    const sweep = (now: number) => {
      const elapsed = now - start;
      const filling = easeOutCubic(Math.min(elapsed / FILL_MS, 1)) * HOLD_AT;

      /* Ready means the document finished loading AND the floor has passed,
         or the ceiling has run out. The arc never waits on the network
         beyond MAX_WAIT_MS. */
      if (
        readyAt === null &&
        ((document.readyState === "complete" && elapsed >= MIN_HOLD_MS) ||
          elapsed >= MAX_WAIT_MS)
      ) {
        readyAt = now;
        progressAtReady = filling;
      }

      const progress =
        readyAt === null
          ? filling
          : progressAtReady +
            (1 - progressAtReady) *
              easeOutCubic(Math.min((now - readyAt) / COMPLETE_MS, 1));

      veil.style.setProperty("--p", progress.toFixed(4));

      if (progress >= 1) {
        setPhase("lit");
        timers.push(window.setTimeout(startExit, LIT_HOLD_MS));
        return;
      }

      frame = requestAnimationFrame(sweep);
    };

    frame = requestAnimationFrame(sweep);

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(window.clearTimeout);
    };
  }, [startExit]);

  /* Leaving the veil on screen after it has done its job is the failure mode
     that matters, so the exit always tears it down on a timer. */
  useEffect(() => {
    if (phase !== "exit") {
      return;
    }

    const timer = window.setTimeout(() => setPhase("done"), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  /* Any deliberate input dismisses it. A visitor who has decided to move is
     never held by a decorative sequence. */
  useEffect(() => {
    if (phase !== "boot" && phase !== "lit") {
      return;
    }

    const skipOnPointer = () => startExit();

    /* Tab is the one key that must not dismiss: it is how a keyboard user
       reaches the Skip control, and swallowing it would leave them with a
       hidden gesture instead of a real, labelled button. */
    const skipOnKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        return;
      }

      startExit();
    };

    window.addEventListener("pointerdown", skipOnPointer, { once: true });
    window.addEventListener("keydown", skipOnKey);

    return () => {
      window.removeEventListener("pointerdown", skipOnPointer);
      window.removeEventListener("keydown", skipOnKey);
    };
  }, [phase, startExit]);

  if (phase === "done") {
    return null;
  }

  return (
    <div
      className={`pure-gate-veil ${styles.veil}`}
      data-phase={phase}
      ref={veilRef}
      role="status"
      aria-live="polite"
    >
      <p className={styles.srOnly} lang="ja">
        PURE OSAKA を読み込んでいます
      </p>

      {/* One ring, drawn twice. Each copy sits at the same place in the
          viewport and is clipped by the leaf that holds it, so the closed
          door shows a single continuous circle and the opening door tears
          that circle in half. */}
      <div className={`${styles.leaf} ${styles.leafTop}`} aria-hidden="true">
        <div className={styles.ringLayer}>
          <GateRing />
        </div>
      </div>
      <div className={`${styles.leaf} ${styles.leafBottom}`} aria-hidden="true">
        <div className={styles.ringLayer}>
          <GateRing withWordmark />
          <span className={styles.head} />
        </div>
      </div>

      <div className={styles.stage} aria-hidden="true">
        <div className={styles.bloom} />

        <div
          className={styles.mark}
          ref={markRef}
          style={flight ? { transform: flight } : undefined}
        >
          {/* Pre-cropped and pre-sized by scripts/build-pure-mark.mjs: 42 KB
              against the 1.4 MB master, because this is the element that has
              to paint first on a cold visit. */}
          <Image
            src="/pure/pure-mark.webp"
            alt=""
            width={623}
            height={699}
            sizes="(max-width: 812px) 128px, 152px"
            priority
          />
        </div>
      </div>

      <button className={styles.skip} type="button" onClick={startExit}>
        Skip intro
      </button>
    </div>
  );
}
