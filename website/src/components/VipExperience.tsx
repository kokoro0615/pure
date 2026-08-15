"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef, useState, type CSSProperties } from "react";

import { ClubRaiaMenu } from "@/components/ClubRaiaMenu";
import { CtaMark } from "@/components/CtaMark";
import { TheCrossContact } from "@/components/TheCrossContact";
import {
  formatYen,
  vipConditions,
  vipGroups,
  vipNotes,
  vipPriceFloor,
  vipSetCount,
  type VipImage,
} from "@/lib/vip-data";

import styles from "./VipExperience.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const DESKTOP_QUERY = "(min-width: 901px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const PHONE_NUMBER = "06-6214-6600";
/** Matches an <option> in TheCrossContact so the form opens ready to send. */
const CONTACT_TOPIC = "VIP table reservation";

const mediaStyle = (image: VipImage) =>
  ({
    "--media-position": image.position,
    "--media-mobile-position": image.mobilePosition,
  }) as CSSProperties;

/**
 * PURE Osaka VIP tables.
 *
 * Governing concept: the bottle reaches your table. A hairline spine runs the
 * left gutter, a champagne spark travels it as you scroll, each set rules
 * itself in from the left, and the light lands on the price. One signature
 * move, carried end to end.
 */
export function VipExperience() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const openContact = useCallback(() => setIsContactOpen(true), []);
  const closeContact = useCallback(() => setIsContactOpen(false), []);

  const pageRef = useRef<HTMLElement>(null);
  const spineRef = useRef<HTMLDivElement>(null);
  const spineTrailRef = useRef<HTMLSpanElement>(null);
  const spineSparkRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const page = pageRef.current;

      if (!page) {
        return;
      }

      const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
      const isDesktop = window.matchMedia(DESKTOP_QUERY).matches;

      /* The spark travels the spine. Transform and scale only, so the whole
         signature move stays on the compositor. */
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

      /* Cover: the room settles while the title rises out of its mask. */
      gsap
        .timeline({ defaults: { ease: "expo.out" } })
        .fromTo(
          `.${styles.heroImage}`,
          { scale: 1.12 },
          { scale: 1.02, duration: 2 },
        )
        .fromTo(
          `.${styles.heroWord}`,
          { yPercent: 110 },
          { yPercent: 0, duration: 1.2, stagger: 0.11 },
          0.18,
        )
        .fromTo(
          `.${styles.heroFoot}`,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.9 },
          0.78,
        );

      /* Each set rules itself in from the left, then the light lands on the
         price. `isLit` only ever gets added here, so a reduced-motion or
         no-JS visit reads the price as plain champagne gold instead. */
      gsap.utils.toArray<HTMLElement>(`.${styles.rows}`).forEach((list) => {
        const rows = gsap.utils.toArray<HTMLElement>(
          `.${styles.row}`,
          list,
        );
        const rules = gsap.utils.toArray<HTMLElement>(
          `.${styles.rowRule}`,
          list,
        );

        gsap
          .timeline({
            scrollTrigger: {
              trigger: list,
              scroller: page,
              start: "top 86%",
              once: true,
            },
          })
          .fromTo(
            rows,
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.75, ease: "power3.out", stagger: 0.11 },
          )
          .fromTo(
            rules,
            { scaleX: 0 },
            { scaleX: 1, duration: 0.72, ease: "power2.out", stagger: 0.11 },
            0.12,
          );

        rows.forEach((row, index) => {
          ScrollTrigger.create({
            trigger: row,
            scroller: page,
            start: "top 86%",
            once: true,
            onEnter: () =>
              gsap.delayedCall(0.34 + index * 0.11, () =>
                row.classList.add(styles.isLit),
              ),
          });
        });
      });

      /* Spread photographs breathe against their frames. The image carries a
         1.09 overscan in CSS so the parallax can never expose the frame. */
      if (isDesktop) {
        gsap.utils
          .toArray<HTMLElement>(`.${styles.spreadImage}`)
          .forEach((image) => {
            gsap.fromTo(
              image,
              { yPercent: -3.4, scale: 1.09 },
              {
                yPercent: 3.4,
                scale: 1.09,
                ease: "none",
                scrollTrigger: {
                  trigger: image.closest(`.${styles.spreadMedia}`) ?? image,
                  scroller: page,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 1,
                },
              },
            );
          });
      }

      /* Quiet entrances for the remaining groups. One group per viewport. */
      gsap.utils.toArray<HTMLElement>(`.${styles.reveal}`).forEach((node) => {
        gsap.fromTo(
          node,
          { opacity: 0, y: 34 },
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
        <a className={styles.skipLink} href="#set-menu">
          Skip to the set menu
        </a>

        <div className={styles.grain} aria-hidden="true" />
        <div className={styles.navScrim} aria-hidden="true" />

        <div ref={spineRef} className={styles.spine} aria-hidden="true">
          <span ref={spineTrailRef} className={styles.spineTrail} />
          <span ref={spineSparkRef} className={styles.spineSpark} />
        </div>

        <section className={styles.hero} aria-labelledby="vip-title">
          <div className={styles.heroMedia}>
            {/* Art direction, not just resizing: the board is a portrait
                subject. Cover-cropping the portrait file into a landscape
                hero threw away half of it, so desktops get a landscape crop
                that holds the whole sign and phones keep the portrait frame.
                <picture> is used over next/image because next/image cannot
                swap the source file per breakpoint. */}
            <picture>
              <source
                media="(min-width: 901px) and (min-aspect-ratio: 1/1)"
                srcSet="/pure/vip/vip-board-wide-1600.webp 1600w, /pure/vip/vip-board-wide-2560.webp 2560w"
                sizes="100vw"
                width={2560}
                height={1706}
              />
              <img
                className={styles.heroImage}
                src="/pure/vip/vip-board-1400.webp"
                srcSet="/pure/vip/vip-board-800.webp 800w, /pure/vip/vip-board-1400.webp 1400w"
                sizes="100vw"
                width={1400}
                height={1866}
                alt="PUREのフロアで掲げられるVIPボードとスパークラーの光"
                fetchPriority="high"
                decoding="async"
              />
            </picture>
            <div className={styles.heroWash} aria-hidden="true" />
          </div>

          <p className={styles.heroEyebrow}>
            <span>PURE Osaka</span>
            <span>Shinsaibashi</span>
          </p>

          <h1 id="vip-title" className={styles.heroTitle}>
            <span className={styles.heroLine}>
              <span className={styles.heroWord}>V.I.P</span>
            </span>
            <span className={styles.heroLine}>
              <span className={styles.heroWord}>Tables</span>
            </span>
          </h1>

          <div className={styles.heroFoot}>
            <p className={styles.heroLead} lang="ja">
              席を取る。
              <br />
              その夜の中心が、そのまま自分の席になる。
            </p>

            <dl className={styles.heroFacts}>
              <div>
                <dt>Table time</dt>
                <dd>2 hours</dd>
              </div>
              <div>
                <dt>Sets</dt>
                <dd>{vipSetCount.toString().padStart(2, "0")}</dd>
              </div>
              <div>
                <dt>From</dt>
                <dd>{formatYen(vipPriceFloor)}</dd>
              </div>
            </dl>
          </div>

        </section>

        <section
          id="set-menu"
          className={styles.ledger}
          aria-labelledby="ledger-title"
        >
          <div className={`${styles.head} ${styles.reveal}`}>
            <p className={styles.eyebrow}>
              <span>Set menu</span>
              <span>2 hour system</span>
            </p>
            <h2 id="ledger-title">
              Six ways
              <br />
              to hold the room.
            </h2>
          </div>

          {vipGroups.map((group, groupIndex) => (
            <article
              className={`${styles.spread} ${
                groupIndex % 2 === 1 ? styles.spreadFlipped : ""
              }`}
              aria-labelledby={`${group.id}-title`}
              key={group.id}
            >
              <div className={styles.spreadMedia}>
                <div className={styles.spreadFrame}>
                  <Image
                    src={group.image.src}
                    alt={group.image.alt}
                    fill
                    sizes="(max-width: 900px) 92vw, 40vw"
                    className={styles.spreadImage}
                    style={mediaStyle(group.image)}
                  />
                  <span className={styles.spreadWash} aria-hidden="true" />
                </div>
                <p className={styles.spreadTag}>
                  <span>{(groupIndex + 1).toString().padStart(2, "0")}</span>
                  <span lang="ja">{group.japaneseLabel}</span>
                </p>
              </div>

              <div className={styles.spreadBody}>
                <header className={styles.groupHead}>
                  <h3 id={`${group.id}-title`}>{group.label}</h3>
                  <p className={styles.groupLead}>{group.lead}</p>
                </header>

                <ul className={styles.rows}>
                  {group.sets.map((set) => (
                    <li className={styles.row} key={set.id}>
                      <span className={styles.rank}>{set.rank}</span>

                      <div className={styles.rowBody}>
                        <h4 className={styles.rowName}>{set.name}</h4>
                        <p className={styles.rowVariant}>
                          {set.variant}
                          {set.variant && set.serving ? (
                            <span aria-hidden="true"> / </span>
                          ) : null}
                          {set.serving}
                        </p>
                        <p className={styles.rowJapanese} lang="ja">
                          {set.japanese}
                        </p>
                      </div>

                      <p className={styles.price}>{formatYen(set.price)}</p>
                      <span className={styles.rowRule} aria-hidden="true" />
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}

          <dl className={`${styles.conditions} ${styles.reveal}`}>
            {vipConditions.map((condition) => (
              <div className={styles.condition} key={condition.label}>
                <dt>{condition.label}</dt>
                <dd>
                  <strong>{condition.value}</strong>
                  <span lang="ja">{condition.japanese}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.rules} aria-labelledby="rules-title">
          <div className={styles.rulesMedia}>
            <Image
              src="/pure/vip/sparkler-wall.webp"
              alt="PUREのブリックウォールの前で火花を上げるボトルサービス"
              fill
              sizes="(max-width: 900px) 92vw, 34vw"
              className={styles.rulesImage}
              style={mediaStyle({
                src: "",
                alt: "",
                position: "48% 60%",
                mobilePosition: "50% 56%",
              })}
            />
            <span className={styles.rulesWash} aria-hidden="true" />
          </div>

          <div className={styles.rulesBody}>
            <div className={`${styles.head} ${styles.reveal}`}>
              <h2 id="rules-title">House rules.</h2>
            </div>

            <ol className={`${styles.notes} ${styles.reveal}`}>
              {vipNotes.map((note, index) => (
                <li key={note}>
                  <span className={styles.noteIndex} aria-hidden="true">
                    {(index + 1).toString().padStart(2, "0")}
                  </span>
                  <p lang="ja">{note}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.cta} aria-labelledby="cta-title">
          <Image
            src="/pure/vip/procession.webp"
            alt="スパークラーを灯したボトルを掲げてフロアを進むPUREのスタッフ"
            fill
            sizes="100vw"
            className={styles.ctaImage}
            style={mediaStyle({
              src: "",
              alt: "",
              position: "52% 34%",
              mobilePosition: "56% 28%",
            })}
          />
          <div className={styles.ctaWash} aria-hidden="true" />

          <div className={styles.ctaContent}>
            <h2 id="cta-title">
              Tell us the date.
              <br />
              We&apos;ll light it.
            </h2>
            <p className={styles.ctaLead} lang="ja">
              ご希望日・ご人数・セットをお知らせください。
              <br />
              当日のご相談も承ります。
            </p>

            <div className={styles.ctaActions}>
              <button className="pure-cta" type="button" onClick={openContact}>
                <span>Reserve a table</span>
                <CtaMark />
              </button>
              <a
                className="pure-cta is-ghost"
                href={`tel:+81${PHONE_NUMBER.replace(/[^0-9]/g, "").slice(1)}`}
              >
                <span>Call {PHONE_NUMBER}</span>
                <CtaMark />
              </a>
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
      {isContactOpen ? (
        <TheCrossContact onClose={closeContact} defaultTopic={CONTACT_TOPIC} />
      ) : null}
    </>
  );
}
