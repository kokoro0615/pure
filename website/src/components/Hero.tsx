"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type WheelEvent,
} from "react";

type Slide = {
  title: string;
  href: string;
  video: string;
  poster: string;
};

const slides: Slide[] = [
  {
    title: "Countdown 2026",
    href: "#countdown-2026",
    video: "/pure/videos/optimized/pure-countdown-2026.web.mp4",
    poster: "/pure/posters/pure-countdown-2026.jpg",
  },
  {
    title: "Halloween",
    href: "#halloween",
    video: "/pure/videos/optimized/pure-halloween.web.mp4",
    poster: "/pure/posters/pure-halloween.jpg",
  },
  {
    title: "20th After Party",
    href: "#20th-after-party",
    video: "/pure/videos/optimized/pure-osaka-20th-afterpub.web.mp4",
    poster: "/pure/posters/pure-osaka-20th-afterpub.jpg",
  },
];

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

function renderTitle(title: string) {
  return title.split("").map((letter, index) => (
    <span
      className={letter === " " ? "clubraia-title-space" : undefined}
      key={`${letter}-${index}`}
    >
      {letter === " " ? "\u00a0" : letter}
    </span>
  ));
}

export function Hero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isIntroVisible, setIsIntroVisible] = useState(true);
  const lastWheelAtRef = useRef(0);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

  const goToPrevious = useCallback(() => {
    setActiveIndex((current) =>
      current === 0 ? slides.length - 1 : current - 1,
    );
  }, []);

  const goToNext = useCallback(() => {
    setActiveIndex((current) => (current + 1) % slides.length);
  }, []);

  const revealHero = useCallback(() => {
    setIsIntroVisible(false);

    const activeVideo = videoRefs.current[activeIndex];
    if (activeVideo) {
      playFromStart(activeVideo);
    }
  }, [activeIndex]);

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

    if (isIntroVisible || !activeVideo) {
      return;
    }

    playFromStart(activeVideo);

    return () => activeVideo.pause();
  }, [activeIndex, isIntroVisible]);

  const slideCount = slides.length.toString().padStart(2, "0");
  const currentSlideNumber = (activeIndex + 1).toString().padStart(2, "0");

  return (
    <section
      className="clubraia-hero pure-hero"
      aria-label="Club Raia hero"
      onWheel={handleWheel}
    >
      <span id="home" className="pure-home-target" aria-hidden="true" />
      <div
        id="loading"
        className={`clubraia-loading pure-loading ${
          isIntroVisible ? "is-active" : "is-hidden"
        }`}
        aria-hidden={!isIntroVisible}
      >
        <canvas id="canvas" className="clubraia-loading-canvas" aria-hidden="true" />
        <div id="canvas-overlay" className="clubraia-canvas-overlay" aria-hidden="true" />
        <div
          id="canvas-overlay-vignette"
          className="clubraia-canvas-overlay-vignette"
          aria-hidden="true"
        />
        <div id="loading-overlay" className="clubraia-loading-overlay" aria-hidden="true" />
        <div className="clubraia-loading-enter pure-loading-enter">
          <h3>Premium Nightlife Experience</h3>
          <a
            className="clubraia-loading-button pure-loading-button"
            href="#home"
            onClick={revealHero}
          >
            Click to Explore
          </a>
        </div>
        <div id="loading-out" className="clubraia-loading-out" aria-hidden="true" />
        <div className="loading-images" aria-hidden="true" />
      </div>

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
              src={slide.video}
              loop
              muted
              playsInline
              preload={index === 0 ? "metadata" : "none"}
              poster={slide.poster}
            />
          </div>
        ))}
      </div>

      <div className="clubraia-vignette pure-vignette" aria-hidden="true" />

      <div className="q-container hero-slider-content">
        {slides.map((slide, index) => (
          <a
            className={`clubraia-slide-title pure-slide-title slider-content ${
              index === activeIndex ? "active" : ""
            }`}
            href={slide.href}
            aria-label={`Explore ${slide.title}`}
            aria-hidden={index !== activeIndex}
            key={`${slide.title}-${index}`}
          >
            <h2>{renderTitle(slide.title)}</h2>
            <h6>Explore</h6>
          </a>
        ))}
      </div>

      <div className="clubraia-page-dots pure-page-dots" aria-label="Hero slides">
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

      <nav className="clubraia-slider-navigation pure-slider-navigation" aria-label="Slide navigation">
        <button
          className="clubraia-slider-button clubraia-slider-button-prev pure-slider-button pure-slider-button-prev"
          type="button"
          onClick={goToPrevious}
          aria-label="Previous slide"
        >
          <Image
            src="/clubraia/arrowleft.svg"
            alt=""
            width={12}
            height={23}
          />
        </button>
        <button
          className="clubraia-slider-button clubraia-slider-button-next pure-slider-button pure-slider-button-next"
          type="button"
          onClick={goToNext}
          aria-label="Next slide"
        >
          <Image
            src="/clubraia/arrowright.svg"
            alt=""
            width={13}
            height={23}
          />
        </button>
      </nav>

      <div className="clubraia-slider-number pure-slider-number" aria-live="polite">
        <span>{currentSlideNumber}</span>
        <span aria-hidden="true"> / </span>
        <span>{slideCount}</span>
      </div>
    </section>
  );
}
