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
  CLOSE_TIME,
  CONTACT_TOPIC,
  OPEN_TIME,
  PHONE_HREF,
  PHONE_NUMBER,
  doorFacts,
  entrySteps,
  pad,
} from "@/lib/tickets-data";

import styles from "./TicketsExperience.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const DESKTOP_QUERY = "(min-width: 901px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * PURE Osaka entry guide.
 *
 * Governing concept: "From the street to the floor." The page is the walk a
 * guest actually makes - pavement, sign, reception, one flight down - and it
 * is told with the venue's own photographs of those four places.
 *
 * Signature move (one): the corridor. On desktop the real passage advances
 * toward the reader on scroll while the four beats hand off one at a time.
 * The choreography is opt-in from JavaScript via `isChoreographed`, so a
 * reduced-motion visit, a phone, or a failed script all fall back to the same
 * readable ledger instead of a stack of invisible text.
 */
export function TicketsExperience() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const openContact = useCallback(() => setIsContactOpen(true), []);
  const closeContact = useCallback(() => setIsContactOpen(false), []);

  const pageRef = useRef<HTMLElement>(null);
  const spineRef = useRef<HTMLDivElement>(null);
  const spineTrailRef = useRef<HTMLSpanElement>(null);
  const spineSparkRef = useRef<HTMLSpanElement>(null);
  const walkRef = useRef<HTMLElement>(null);
  const corridorRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const page = pageRef.current;

      if (!page) {
        return;
      }

      const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
      const isDesktop = window.matchMedia(DESKTOP_QUERY).matches;

      /* The spine carries scroll position on every PURE route. Transform and
         scale only, so it never leaves the compositor. */
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

      /* Cover: the street settles while the title rises out of its mask. */
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
          `.${styles.heroFoot}`,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.9 },
          0.72,
        );

      /* The walk. The stage is a native `position: sticky` element and GSAP
         only scrubs transforms and opacity across it - no pinning, so the
         custom `position: fixed` scroller cannot be thrown out of sync. */
      const walk = walkRef.current;
      const corridor = corridorRef.current;

      if (isDesktop && walk && corridor) {
        const steps = gsap.utils.toArray<HTMLElement>(`.${styles.step}`, walk);
        const marks = gsap.utils.toArray<HTMLElement>(`.${styles.mark}`, walk);

        /* Adding the class first makes the section tall and the stage sticky.
           Every trigger below is measured after that, and the section sits
           well below the fold at load, so nothing visible shifts. */
        walk.classList.add(styles.isChoreographed);

        /* The rail is driven from this one timeline rather than from four
           more triggers: the sticky stage makes the scrubbed range shorter
           than the section, so any separately measured trigger drifts. */
        let currentMark = 0;
        marks[0]?.classList.add(styles.isCurrent);

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: walk,
            scroller: page,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.55,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const index = Math.min(
                steps.length - 1,
                Math.floor(self.progress * steps.length),
              );

              if (index === currentMark) {
                return;
              }

              marks[currentMark]?.classList.remove(styles.isCurrent);
              marks[index]?.classList.add(styles.isCurrent);
              currentMark = index;
            },
          },
        });

        /* You move down the passage: the vanishing point holds while the
           frame grows past you. */
        timeline.fromTo(
          corridor,
          { scale: 1.02 },
          { scale: 1.46, ease: "none", duration: 1 },
          0,
        );

        const span = 1 / steps.length;

        steps.forEach((step, index) => {
          const at = index * span;

          if (index === 0) {
            timeline.set(step, { opacity: 1, y: 0 }, 0);
          } else {
            timeline.fromTo(
              step,
              { opacity: 0, y: 38 },
              { opacity: 1, y: 0, duration: span * 0.44, ease: "power2.out" },
              at,
            );
          }

          if (index < steps.length - 1) {
            timeline.to(
              step,
              {
                opacity: 0,
                y: -30,
                duration: span * 0.32,
                ease: "power2.in",
              },
              at + span * 0.68,
            );
          }
        });
      }

      /* Quiet entrances everywhere else. One group per viewport. */
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

      /* Photographs and webfonts settle after first paint, and every pixel
         they add above a trigger moves that trigger. Re-measure. */
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
        <a className={styles.skipLink} href="#the-walk">
          Skip to the entry guide
        </a>

        <div className={styles.grain} aria-hidden="true" />
        <div className={styles.navScrim} aria-hidden="true" />

        <div ref={spineRef} className={styles.spine} aria-hidden="true">
          <span ref={spineTrailRef} className={styles.spineTrail} />
          <span ref={spineSparkRef} className={styles.spineSpark} />
        </div>

        <section className={styles.hero} aria-labelledby="tickets-title">
          <div className={styles.heroMedia}>
            <Image
              className={styles.heroImage}
              src="/pure/tickets/door-street-2400.webp"
              alt="心斎橋筋に面したPURE Osakaの入口とPUREの看板"
              fill
              sizes="100vw"
              priority
              fetchPriority="high"
            />
            <div className={styles.heroWash} aria-hidden="true" />
          </div>

          <p className={styles.heroEyebrow}>
            <span>PURE Osaka</span>
            <span>Entry &amp; door</span>
          </p>

          <h1 id="tickets-title" className={styles.heroTitle}>
            <span className={styles.heroLine}>
              <span className={styles.heroWord}>Doors</span>
            </span>
            <span className={styles.heroLine}>
              <span className={`${styles.heroWord} ${styles.heroNumerals}`}>
                at {OPEN_TIME}
              </span>
            </span>
          </h1>

          <div className={styles.heroFoot}>
            <p className={styles.heroLead} lang="ja">
              心斎橋筋の看板の下が、そのまま入口です。
              <br />
              階段を降りれば、そこがフロア。
            </p>

            <dl className={styles.heroFacts}>
              <div>
                <dt>Open</dt>
                <dd>{OPEN_TIME}</dd>
              </div>
              <div>
                <dt>Close</dt>
                <dd>{CLOSE_TIME}</dd>
              </div>
              <div>
                <dt>Floor</dt>
                <dd>B1F</dd>
              </div>
            </dl>
          </div>
        </section>

        <section
          ref={walkRef}
          id="the-walk"
          className={styles.walk}
          aria-labelledby="walk-title"
        >
          <div className={styles.stage}>
            <div className={styles.corridorFrame}>
              <div ref={corridorRef} className={styles.corridor}>
                <Image
                  className={styles.corridorImage}
                  src="/pure/tickets/corridor-2000.webp"
                  alt="PURE 20のネオンが灯る、店内へ続く通路"
                  fill
                  sizes="100vw"
                />
              </div>
              <div className={styles.corridorWash} aria-hidden="true" />
            </div>

            <div className={styles.stageBody}>
              <div className={styles.walkHead}>
                <h2 id="walk-title">
                  From the street
                  <br />
                  to the floor.
                </h2>
              </div>

              <ol className={styles.steps}>
                {entrySteps.map((step, index) => (
                  <li className={styles.step} key={step.id}>
                    <p className={styles.stepIndex} aria-hidden="true">
                      {pad(index + 1)}
                    </p>
                    <div className={styles.stepBody}>
                      <h3 className={styles.stepLabel}>
                        {step.label}
                        <span className={styles.stepJapanese} lang="ja">
                          {step.japaneseLabel}
                        </span>
                      </h3>
                      <p className={styles.stepLead}>{step.lead}</p>
                      <p className={styles.stepDetail} lang="ja">
                        {step.detail.map((line, lineIndex) => (
                          <span key={line}>
                            {lineIndex > 0 ? <br /> : null}
                            {line}
                          </span>
                        ))}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <ol className={styles.rail} aria-hidden="true">
              {entrySteps.map((step) => (
                <li className={styles.mark} key={step.id}>
                  <span className={styles.markRule} />
                  <span>{step.label}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.before} aria-labelledby="before-title">
          <div className={`${styles.beforeHead} ${styles.reveal}`}>
            <p className={styles.eyebrow}>
              <span>Before you leave</span>
            </p>
            <h2 id="before-title">
              Four things
              <br />
              worth checking.
            </h2>
            <p className={styles.beforeLead} lang="ja">
              入口で迷わないための、最小限です。
              <br />
              ここに無いことは、お電話で。
            </p>
          </div>

          <dl className={`${styles.facts} ${styles.reveal}`}>
            {doorFacts.map((fact) => (
              <div className={styles.fact} key={fact.id}>
                <dt className={styles.factLabel}>{fact.label}</dt>
                <dd className={styles.factBody}>
                  <p
                    className={`${styles.factValue} ${
                      fact.isNumeric ? styles.factNumerals : ""
                    }`}
                  >
                    {fact.value}
                  </p>
                  <p className={styles.factNote} lang="ja">
                    {fact.note.map((line, lineIndex) => (
                      <span key={line}>
                        {lineIndex > 0 ? <br /> : null}
                        {line}
                      </span>
                    ))}
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.cta} aria-labelledby="cta-title">
          <Image
            className={styles.ctaImage}
            src="/pure/tickets/floor-2400.webp"
            alt="PUREのフロアで音に合わせて動く来場者とDJブース"
            fill
            sizes="100vw"
          />
          <div className={styles.ctaWash} aria-hidden="true" />

          <div className={styles.ctaContent}>
            <h2 id="cta-title">
              We&apos;ll be
              <br />
              at the door.
            </h2>
            <p className={styles.ctaLead} lang="ja">
              料金やお席のご相談は、お電話が確実です。
              <br />
              フォームからのお問い合わせも承ります。
            </p>

            <div className={styles.ctaActions}>
              <a className="pure-cta" href={PHONE_HREF}>
                <span>Call {PHONE_NUMBER}</span>
                <CtaMark />
              </a>
              <button className="pure-cta is-ghost" type="button" onClick={openContact}>
                <span>Send a question</span>
                <CtaMark />
              </button>
            </div>

            <nav className={styles.ctaLinks} aria-label="Related pages">
              <Link href="/qa">Q&amp;A</Link>
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
