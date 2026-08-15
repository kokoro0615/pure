"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { ClubRaiaMenu } from "@/components/ClubRaiaMenu";
import { CtaMark } from "@/components/CtaMark";
import { TheCrossContact } from "@/components/TheCrossContact";
import {
  CONTACT_TOPIC,
  PHONE_HREF,
  PHONE_NUMBER,
  pad,
  qaEntries,
} from "@/lib/qa-data";

import styles from "./QaExperience.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function DownIcon() {
  return (
    <svg
      className={styles.heroCueArrow}
      viewBox="0 0 12 13"
      fill="none"
      aria-hidden="true"
    >
      <path d="M6 0.8v10.6M1.6 7.4 6 11.8l4.4-4.4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19 19 5M8 5h11v11" />
    </svg>
  );
}

/**
 * PURE Osaka questions.
 *
 * Governing concept: "The wall of placards." PURE's own passage is papered
 * wall to wall with gift placards from other rooms, and this page borrows
 * that material - every answer is one notice posted on a dark wall.
 *
 * Signature move (one): only the notice you opened is lit. The row's numeral
 * takes the magenta, a hairline draws down the answer as it opens, and every
 * other row drops in value. The panel opens on `grid-template-rows: 0fr` to
 * `1fr`, so nothing animates height and nothing measures the DOM.
 */
export function QaExperience() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(qaEntries[0]?.id ?? null);

  const openContact = useCallback(() => setIsContactOpen(true), []);
  const closeContact = useCallback(() => setIsContactOpen(false), []);

  const pageRef = useRef<HTMLElement>(null);
  const spineRef = useRef<HTMLDivElement>(null);
  const spineTrailRef = useRef<HTMLSpanElement>(null);
  const spineSparkRef = useRef<HTMLSpanElement>(null);

  const toggleEntry = useCallback((id: string) => {
    setOpenId((current) => (current === id ? null : id));
  }, []);

  useGSAP(
    () => {
      const page = pageRef.current;

      if (!page) {
        return;
      }

      const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;

      const spine = spineRef.current;
      const trail = spineTrailRef.current;
      const spark = spineSparkRef.current;

      if (spine && trail && spark && !reduceMotion) {
        let travel = spine.clientHeight;
        const setTrail = gsap.quickSetter(trail, "scaleY");
        const setSpark = gsap.quickSetter(spark, "y", "px");

        ScrollTrigger.create({
          scroller: page,
          start: 0,
          end: "max",
          invalidateOnRefresh: true,
          onRefresh: () => {
            travel = spine.clientHeight;
          },
          onUpdate: (self) => {
            const progress = Math.max(self.progress, 0.015);
            setTrail(progress);
            setSpark(progress * travel);
          },
        });
      }

      if (reduceMotion) {
        ScrollTrigger.refresh();
        return;
      }

      /* Cover: the wall settles while the title rises out of its mask. */
      gsap
        .timeline({ defaults: { ease: "expo.out" } })
        .fromTo(
          `.${styles.heroImage}`,
          { scale: 1.1 },
          { scale: 1.02, duration: 1.9 },
        )
        .fromTo(
          `.${styles.heroWord}`,
          { yPercent: 112 },
          { yPercent: 0, duration: 1.15, stagger: 0.1 },
          0.16,
        )
        .fromTo(
          [`.${styles.heroFoot}`, `.${styles.heroCue}`],
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.9, stagger: 0.12 },
          0.72,
        );

      /* The notices post themselves as the wall comes into view. */
      const rows = gsap.utils.toArray<HTMLElement>(`.${styles.row}`);

      if (rows.length > 0) {
        gsap.fromTo(
          rows,
          { opacity: 0, y: 26 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            stagger: 0.07,
            scrollTrigger: {
              trigger: rows[0],
              scroller: page,
              start: "top 88%",
              once: true,
            },
          },
        );
      }

      gsap.utils.toArray<HTMLElement>(`.${styles.reveal}`).forEach((node) => {
        gsap.fromTo(
          node,
          { opacity: 0, y: 32 },
          {
            opacity: 1,
            y: 0,
            duration: 0.85,
            ease: "power3.out",
            scrollTrigger: {
              trigger: node,
              scroller: page,
              start: "top 90%",
              once: true,
            },
          },
        );
      });

      void document.fonts?.ready.then(() => ScrollTrigger.refresh());

      let refreshTimer = 0;
      const refresh = () => {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 200);
      };

      const observer = new ResizeObserver(refresh);
      observer.observe(page.firstElementChild ?? page);

      return () => {
        window.clearTimeout(refreshTimer);
        observer.disconnect();
      };
    },
    { scope: pageRef },
  );

  return (
    <>
      <main ref={pageRef} className={styles.page}>
        <a className={styles.skipLink} href="#questions">
          Skip to the questions
        </a>

        <div className={styles.grain} aria-hidden="true" />
        <div className={styles.navScrim} aria-hidden="true" />

        <div ref={spineRef} className={styles.spine} aria-hidden="true">
          <span ref={spineTrailRef} className={styles.spineTrail} />
          <span ref={spineSparkRef} className={styles.spineSpark} />
        </div>

        <section className={styles.hero} aria-labelledby="qa-title">
          <div className={styles.heroMedia}>
            <Image
              className={styles.heroImage}
              src="/pure/qa/placard-wall-2400.webp"
              alt="贈札が壁一面に並ぶPURE Osakaの通路とPUREのネオンサイン"
              fill
              sizes="100vw"
              priority
              fetchPriority="high"
            />
            <div className={styles.heroWash} aria-hidden="true" />
          </div>

          <p className={styles.heroEyebrow}>
            <span>PURE Osaka</span>
            <span>House notes</span>
          </p>

          <h1 id="qa-title" className={styles.heroTitle}>
            <span className={styles.heroLine}>
              <span className={styles.heroWord}>Before</span>
            </span>
            <span className={styles.heroLine}>
              <span className={styles.heroWord}>you come</span>
            </span>
          </h1>

          <div className={styles.heroFoot}>
            <p className={styles.heroLead} lang="ja">
              入る前に、確かめておきたいこと。
              <br />
              ここに無いことは、直接おたずねください。
            </p>
          </div>

          {/* Handset only (see the module): the portrait cover runs a full
              viewport, so the frame needs a terminus under the photograph. */}
          <a className={styles.heroCue} href="#questions">
            <span>{pad(qaEntries.length)} questions</span>
            <DownIcon />
          </a>
        </section>

        <section
          id="questions"
          className={styles.wall}
          aria-labelledby="wall-title"
        >
          <div className={`${styles.wallHead} ${styles.reveal}`}>
            <p className={styles.eyebrow}>
              <span>Q &amp; A</span>
            </p>
            <h2 id="wall-title">
              Posted
              <br />
              on the wall.
            </h2>
            <p className={styles.wallLead} lang="ja">
              PUREの通路には、贈札が並んでいます。
              <br />
              この壁に、答えも貼っておきます。
            </p>
          </div>

          <ul className={styles.rows}>
            {qaEntries.map((entry, index) => {
              const isOpen = openId === entry.id;

              return (
                <li
                  className={`${styles.row} ${isOpen ? styles.isOpen : ""}`}
                  key={entry.id}
                >
                  <h3 className={styles.rowHeading}>
                    <button
                      className={styles.rowTrigger}
                      type="button"
                      onClick={() => toggleEntry(entry.id)}
                      aria-expanded={isOpen}
                      aria-controls={`qa-answer-${entry.id}`}
                      id={`qa-question-${entry.id}`}
                    >
                      <span className={styles.rowIndex} aria-hidden="true">
                        {pad(index + 1)}
                      </span>
                      <span className={styles.rowQuestion} lang="ja">
                        {entry.question}
                      </span>
                      <span className={styles.rowLabel} aria-hidden="true">
                        {entry.label}
                      </span>
                      <span className={styles.rowSign} aria-hidden="true">
                        <span />
                        <span />
                      </span>
                    </button>
                  </h3>

                  <div
                    className={styles.answer}
                    id={`qa-answer-${entry.id}`}
                    role="region"
                    aria-labelledby={`qa-question-${entry.id}`}
                  >
                    <div className={styles.answerInner}>
                      <span className={styles.answerRule} aria-hidden="true" />
                      <div className={styles.answerBody}>
                        {entry.answer.map((paragraph) => (
                          <p lang="ja" key={paragraph}>
                            {paragraph}
                          </p>
                        ))}

                        {entry.link ? (
                          <Link
                            className={styles.answerLink}
                            href={entry.link.href}
                          >
                            <span lang="ja">{entry.link.label}</span>
                            <ArrowIcon />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={styles.ask} aria-labelledby="ask-title">
          <div className={styles.askMedia}>
            <Image
              className={styles.askImage}
              src="/pure/qa/wall-pure-1800.webp"
              alt="レンガの壁に灯るPUREのサイン"
              fill
              sizes="(max-width: 900px) 92vw, 38vw"
            />
            <span className={styles.askWash} aria-hidden="true" />
          </div>

          <div className={styles.askBody}>
            <div className={`${styles.askHead} ${styles.reveal}`}>
              <h2 id="ask-title">
                Not on
                <br />
                the wall?
              </h2>
              <p className={styles.askLead} lang="ja">
                服装やお支払いなど、ここに載せていないご質問は、
                <br />
                お電話でおたずねいただくのが確実です。
              </p>
            </div>

            <div className={`${styles.askActions} ${styles.reveal}`}>
              <a className="pure-cta" href={PHONE_HREF}>
                <span>Call {PHONE_NUMBER}</span>
                <CtaMark />
              </a>
              <button className="pure-cta is-ghost" type="button" onClick={openContact}>
                <span>Send a question</span>
                <CtaMark />
              </button>
            </div>

            <nav className={styles.askLinks} aria-label="Related pages">
              <Link href="/tickets">Entry &amp; door</Link>
              <Link href="/vip">VIP Tables</Link>
              <Link href="/access">Access</Link>
            </nav>
          </div>

          <footer className={styles.footer}>
            <span>PURE OSAKA</span>
            <Link href="/access">Shinsaibashi / Osaka</Link>
            <span>© {new Date().getFullYear()}</span>
          </footer>
        </section>
      </main>

      <ClubRaiaMenu isContactOpen={isContactOpen} onContact={openContact} />
      {isContactOpen ? (
        <TheCrossContact onClose={closeContact} defaultTopic={CONTACT_TOPIC} />
      ) : null}
    </>
  );
}
