"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from "react";

import { CtaMark } from "@/components/CtaMark";
import {
  InstagramIcon,
  SOCIAL_LINKS,
  YoutubeIcon,
} from "@/components/social";

type Slide = {
  title: string;
  /** Basename of the encode set: `<stem>-{540,720}.{webm,mp4}`. */
  stem: string;
  poster: string;
};

const PHONE_QUERY = "(max-width: 812px)";

/* Finger travel that separates a swipe from a tap. Below this a drag on the
   plate is still a press, which is what a thumb resting on a button does. */
const SWIPE_THRESHOLD_PX = 44;

/* Slide titles name the night on screen; they are not links. The anchors
   they used to carry had no target anywhere in the app, so the only
   content affordance on the homepage did nothing when clicked. The hero
   now carries two real destinations instead, below. */
const slides: Slide[] = [
  {
    title: "21st After Party",
    stem: "/pure/videos/optimized/pure-osaka-21st-afterpub",
    poster: "/pure/posters/pure-osaka-21st-afterpub.jpg",
  },
  {
    title: "Countdown 2026",
    stem: "/pure/videos/optimized/pure-countdown-2026",
    poster: "/pure/posters/pure-countdown-2026.jpg",
  },
  {
    title: "Halloween",
    stem: "/pure/videos/optimized/pure-halloween",
    poster: "/pure/posters/pure-halloween.jpg",
  },
  {
    title: "20th After Party",
    stem: "/pure/videos/optimized/pure-osaka-20th-afterpub",
    poster: "/pure/posters/pure-osaka-20th-afterpub.jpg",
  },
];

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

function getConnection(): NetworkInformation | undefined {
  if (typeof navigator === "undefined") {
    return undefined;
  }

  return (navigator as Navigator & { connection?: NetworkInformation })
    .connection;
}

/**
 * Whether this visit should fetch hero video at all.
 *
 * The poster is a real frame of the same clip, so a metered or very slow
 * connection loses atmosphere, not information. Read through
 * useSyncExternalStore rather than an effect, so the server renders the
 * permissive value and the client re-reads it on hydration and again
 * whenever the connection itself changes.
 */
function readVideoAllowed() {
  const connection = getConnection();

  if (!connection) {
    return true;
  }

  if (connection.saveData) {
    return false;
  }

  return (
    connection.effectiveType !== "slow-2g" && connection.effectiveType !== "2g"
  );
}

function subscribeToConnection(onChange: () => void) {
  const connection = getConnection();
  connection?.addEventListener?.("change", onChange);
  return () => connection?.removeEventListener?.("change", onChange);
}

function playFromStart(video: HTMLVideoElement) {
  if (video.readyState === 0) {
    video.load();
  } else {
    video.currentTime = 0;
  }

  void video.play().catch(() => {
    // The poster remains visible if the browser blocks background playback.
  });
}

export function Hero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const lastWheelAtRef = useRef(0);
  const swipeOriginRef = useRef<{ x: number; y: number } | null>(null);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const allowVideo = useSyncExternalStore(
    subscribeToConnection,
    readVideoAllowed,
    () => true,
  );

  const goToPrevious = useCallback(() => {
    setActiveIndex((current) =>
      current === 0 ? slides.length - 1 : current - 1,
    );
  }, []);

  const goToNext = useCallback(() => {
    setActiveIndex((current) => (current + 1) % slides.length);
  }, []);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLElement>) => {
      if (typeof window === "undefined" || window.innerWidth < 768) {
        return;
      }

      const now = Date.now();
      if (now - lastWheelAtRef.current < 1500) {
        return;
      }

      lastWheelAtRef.current = now;
      if (event.deltaY > 0) {
        goToNext();
        return;
      }

      if (event.deltaY < 0) {
        goToPrevious();
      }
    },
    [goToNext, goToPrevious],
  );

  /* Touch gets the gesture it expects. The phone used to carry two arrow
     controls pinned to the edges of the hero on top of a numbered pager —
     three affordances for one piece of state. The arrows are gone below
     812px and the swipe replaces them; the pager stays, because it is the
     only one of the three that also reports where you are. */
  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerType !== "touch") {
        return;
      }

      swipeOriginRef.current = { x: event.clientX, y: event.clientY };
    },
    [],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const origin = swipeOriginRef.current;
      swipeOriginRef.current = null;

      if (!origin || event.pointerType !== "touch") {
        return;
      }

      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;

      /* Horizontal intent only, so a vertical drag never changes the night. */
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) {
        return;
      }

      if (dx < 0) {
        goToNext();
        return;
      }

      goToPrevious();
    },
    [goToNext, goToPrevious],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        goToNext();
      }

      if (event.key === "ArrowLeft") {
        goToPrevious();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrevious]);

  useEffect(() => {
    const activeVideo = videoRefs.current[activeIndex];

    videoRefs.current.forEach((video, index) => {
      if (video && index !== activeIndex) {
        video.pause();
      }
    });

    if (!activeVideo || !allowVideo) {
      return;
    }

    playFromStart(activeVideo);

    return () => activeVideo.pause();
  }, [activeIndex, allowVideo]);

  /* These clips are 11-20 MB each. A backgrounded tab kept decoding one
     the whole time it was hidden; stop on blur and resume on return. */
  useEffect(() => {
    const handleVisibility = () => {
      const activeVideo = videoRefs.current[activeIndex];
      if (!activeVideo) {
        return;
      }

      if (document.hidden) {
        activeVideo.pause();
        return;
      }

      if (allowVideo) {
        void activeVideo.play().catch(() => {
          // Poster stays visible if the browser refuses to resume.
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [activeIndex, allowVideo]);

  const slideCount = slides.length.toString().padStart(2, "0");
  const currentSlideNumber = (activeIndex + 1).toString().padStart(2, "0");

  return (
    <section
      className="clubraia-hero pure-hero"
      aria-label="PURE Osaka"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        swipeOriginRef.current = null;
      }}
    >
      <span id="home" aria-hidden="true" />

      {/* The click-to-enter gate used to carry the page's only <h1>. The gate
          is gone (the entry veil now covers arrival), but the document still
          needs one heading, and the hero itself is video, so it is carried
          here for search and assistive tech rather than drawn on screen. */}
      <h1 className="pure-visually-hidden">
        PURE OSAKA - 大阪・心斎橋のナイトクラブ
      </h1>

      <div className="clubraia-bg-track pure-bg-track" aria-hidden="true">
        {slides.map((slide, index) => (
          <div
            className={`clubraia-bg-slide pure-bg-slide ${
              index === activeIndex ? "is-active" : ""
            }`}
            key={`${slide.title}-${index}`}
          >
            <video
              ref={(video) => {
                videoRefs.current[index] = video;
              }}
              className="clubraia-bg-image pure-bg-video"
              loop
              muted
              playsInline
              preload={index === 0 ? "metadata" : "none"}
              poster={slide.poster}
            >
              {/* First match wins, so the phone pair is declared before the
                  full-width pair and WebM before MP4 inside each. On a
                  Save-Data or 2G connection none are declared at all. */}
              {allowVideo ? (
                <>
                  <source
                    media={PHONE_QUERY}
                    src={`${slide.stem}-540.webm`}
                    type="video/webm"
                  />
                  <source
                    media={PHONE_QUERY}
                    src={`${slide.stem}-540.mp4`}
                    type="video/mp4"
                  />
                  <source src={`${slide.stem}-720.webm`} type="video/webm" />
                  <source src={`${slide.stem}-720.mp4`} type="video/mp4" />
                </>
              ) : null}
            </video>
          </div>
        ))}
      </div>

      <div className="clubraia-vignette pure-vignette" aria-hidden="true" />

      <div className="hero-slider-content">
        <div className="pure-hero-actions" id="hero-actions">
          <Link className="pure-cta" href="/gallery">
            <span>See the night</span>
            <CtaMark />
          </Link>
          <Link className="pure-cta is-ghost" href="/access">
            <span>Hours &amp; access</span>
            <CtaMark />
          </Link>
        </div>
      </div>

      {/* The hero's bottom edge, as one ruled bar: where you are on the left,
          where to follow the venue on the right. On a desktop the accounts
          live in the header and this collapses back to the pager alone. */}
      <div className="pure-hero-rail">
        <div
          className="clubraia-page-dots pure-page-dots"
          aria-label="Hero slides"
        >
          {slides.map((slide, index) => (
            <button
              className={`clubraia-page-dot pure-page-dot ${
                index === activeIndex ? "is-selected" : ""
              }`}
              type="button"
              key={`${slide.title}-${index}`}
              onClick={() => setActiveIndex(index)}
              aria-label={`Show ${slide.title}`}
              aria-pressed={index === activeIndex}
            >
              <span>{(index + 1).toString().padStart(2, "0")}</span>
            </button>
          ))}
        </div>

        <nav className="pure-hero-social" aria-label="Follow PURE Osaka">
          <a
            href={SOCIAL_LINKS.youtube}
            target="_blank"
            rel="noreferrer"
            aria-label="PURE Osaka on YouTube"
          >
            <YoutubeIcon />
          </a>
          <a
            href={SOCIAL_LINKS.instagram}
            target="_blank"
            rel="noreferrer"
            aria-label="PURE Osaka on Instagram"
          >
            <InstagramIcon />
          </a>
        </nav>
      </div>

      <nav
        className="clubraia-slider-navigation pure-slider-navigation"
        aria-label="Slide navigation"
      >
        <button
          className="clubraia-slider-button clubraia-slider-button-prev pure-slider-button pure-slider-button-prev"
          type="button"
          onClick={goToPrevious}
          aria-label="Previous slide"
        >
          <Image src="/clubraia/arrowleft.svg" alt="" width={12} height={23} />
        </button>
        <button
          className="clubraia-slider-button clubraia-slider-button-next pure-slider-button pure-slider-button-next"
          type="button"
          onClick={goToNext}
          aria-label="Next slide"
        >
          <Image src="/clubraia/arrowright.svg" alt="" width={13} height={23} />
        </button>
      </nav>

      <p className="pure-visually-hidden" aria-live="polite">
        {`Slide ${currentSlideNumber} of ${slideCount}`}
      </p>
    </section>
  );
}
