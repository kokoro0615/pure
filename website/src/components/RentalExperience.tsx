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
import { PHONE_HREF, PHONE_NUMBER } from "@/lib/qa-data";
import {
  RENTAL_CONTACT_TOPIC,
  rentalFacts,
  rentalRoom,
  rentalSteps,
  rentalUses,
} from "@/lib/rental-data";

import styles from "./RentalExperience.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const framePosition = (position: string) =>
  ({ "--media-position": position }) as CSSProperties;

/**
 * PURE Osaka venue hire.
 *
 * Governing concept: "ひと晩、この部屋ごと" — one night, the whole room.
 * The page hands the floor over, and every open question is walked to the
 * same door: CONTACT.
 *
 * Signature move (one, and only one): the cover. The two words rise out of
 * their masks over the full-bleed floor and a hairline draws under them, on
 * transform only, once. Everything below is the house vocabulary — a rule
 * that draws from the left, and copy that arrives once, in order.
 *
 * The hire fee is carried by the cover's fact strip and by the menu tile
 * badge. It had its own display-scale section; the venue asked for that
 * removed, so the figure now lives in one place only.
 */
export function RentalExperience() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const openContact = useCallback(() => setIsContactOpen(true), []);
  const closeContact = useCallback(() => setIsContactOpen(false), []);

  const pageRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const page = pageRef.current;

      if (!page) {
        return;
      }

      /* Reduced motion keeps the authored still state: every element is
         already where the motion would have left it, so nothing is missing
         and nothing travels. */
      if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
        ScrollTrigger.refresh();
        return;
      }

      /* Cover: the room settles while the two words rise out of their masks. */
      gsap
        .timeline({ defaults: { ease: "expo.out" } })
        .fromTo(
          `.${styles.heroImage}`,
          { scale: 1.1 },
          { scale: 1.02, duration: 2.1 },
        )
        .fromTo(
          `.${styles.heroWord}`,
          { yPercent: 112 },
          { yPercent: 0, duration: 1.15, stagger: 0.1 },
          0.16,
        )
        .fromTo(
          `.${styles.heroRule}`,
          { scaleX: 0 },
          { scaleX: 1, duration: 0.9, ease: "power2.out" },
          0.62,
        )
        .fromTo(
          `.${styles.heroFoot}`,
          { opacity: 0, y: 22 },
          { opacity: 1, y: 0, duration: 0.85 },
          0.72,
        );

      /* Quiet groups: heads, notes and the closing block arrive once. */
      gsap.utils.toArray<HTMLElement>(`.${styles.reveal}`).forEach((group) => {
        gsap.fromTo(
          group,
          { opacity: 0, y: 26 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: group,
              scroller: page,
              start: "top 88%",
              once: true,
            },
          },
        );
      });

      /* The room, row by row: each line rises and rules itself in from the
         left — the same 1px gesture /vip uses under a price. */
      const roomList = page.querySelector<HTMLElement>(`.${styles.roomList}`);

      if (roomList) {
        gsap
          .timeline({
            scrollTrigger: {
              trigger: roomList,
              scroller: page,
              start: "top 84%",
              once: true,
            },
          })
          .fromTo(
            `.${styles.roomRow}`,
            { opacity: 0, y: 30 },
            {
              opacity: 1,
              y: 0,
              duration: 0.75,
              ease: "power3.out",
              stagger: 0.1,
            },
          )
          .fromTo(
            `.${styles.roomRule}`,
            { scaleX: 0 },
            { scaleX: 1, duration: 0.7, ease: "power2.out", stagger: 0.1 },
            0.12,
          );
      }

      /* Cards and steps: one stagger each, nothing per-frame. */
      [`.${styles.useCard}`, `.${styles.step}`].forEach((selector) => {
        const items = gsap.utils.toArray<HTMLElement>(selector);

        if (items.length === 0) {
          return;
        }

        gsap.fromTo(
          items,
          { opacity: 0, y: 34 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.09,
            scrollTrigger: {
              trigger: items[0].parentElement ?? items[0],
              scroller: page,
              start: "top 86%",
              once: true,
            },
          },
        );
      });

      /* The timeline's ticks draw onto the rule as their step arrives — the
         same 1px gesture the room rows use, on the page's last object. */
      const stepList = page.querySelector<HTMLElement>(`.${styles.steps}`);

      if (stepList) {
        gsap.fromTo(
          `.${styles.stepTick}`,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: 0.7,
            ease: "power2.out",
            stagger: 0.09,
            scrollTrigger: {
              trigger: stepList,
              scroller: page,
              start: "top 86%",
              once: true,
            },
          },
        );
      }

      ScrollTrigger.refresh();
    },
    { scope: pageRef },
  );

  return (
    <>
      <main ref={pageRef} className={styles.page}>
        <a className={styles.skipLink} href="#rental-room-title">
          Skip to the details
        </a>

        <div className={styles.grain} aria-hidden="true" />
        <div className={styles.navScrim} aria-hidden="true" />

        {/* ------------------------------ cover ------------------------------ */}
        <section className={styles.hero} aria-labelledby="rental-title">
          <div className={styles.heroMedia}>
            <Image
              className={styles.heroImage}
              src="/pure/rental/room-2400.webp"
              alt="PURE Osakaのフロア全景。DJブースから客席とバックバーまでを見渡した様子。"
              fill
              sizes="100vw"
              priority
              fetchPriority="high"
            />
            <span className={styles.heroWash} aria-hidden="true" />
          </div>

          <div className={styles.heroTop}>
            <p className={styles.eyebrow}>
              <span>PURE Osaka</span>
              <span className={styles.eyebrowRule} aria-hidden="true" />
              <span>Shinsaibashi</span>
            </p>
            <p className={styles.heroBadge}>Venue hire</p>
          </div>

          <div className={styles.heroBody}>
            <h1 className={styles.heroTitle} id="rental-title">
              <span className={styles.heroLine}>
                <span className={styles.heroWord}>Rental</span>
              </span>
              <span className={styles.heroLine}>
                <span className={styles.heroWord}>The whole room.</span>
              </span>
            </h1>

            <span className={styles.heroRule} aria-hidden="true" />

            <div className={styles.heroFoot}>
              <p className={styles.heroLead} lang="ja">
                ひと晩、この部屋ごと。
                <br />
                心斎橋のフロアを、まるごと貸し切れます。
              </p>

              <dl className={styles.heroFacts}>
                {rentalFacts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>
                      <span className={styles.factValue}>{fact.value}</span>
                      <span className={styles.factJapanese} lang="ja">
                        {fact.japanese}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <p className={styles.scrollCue} aria-hidden="true">
            <span>Scroll</span>
            <span className={styles.scrollCueRule} />
          </p>
        </section>

        {/* ------------------------------ the room ------------------------------ */}
        <section className={styles.room} aria-labelledby="rental-room-title">
          <div className={styles.roomMedia}>
            <div className={styles.roomFrame}>
              <Image
                className={styles.roomImage}
                src="/pure/gallery/venue-signage-decor-004-013-dsc-0406.webp"
                alt="PUREの店内。バーカウンターと照明に照らされた壁面。"
                fill
                sizes="(max-width: 900px) 92vw, 38vw"
                style={framePosition("50% 46%")}
              />
              <span className={styles.roomWash} aria-hidden="true" />
            </div>
            <p className={styles.roomCaption} lang="ja">
              大阪市中央区心斎橋筋2-3-12
              <br />
              ダイヤモンドビル B1F
            </p>
          </div>

          <div className={styles.roomBody}>
            <div className={`${styles.head} ${styles.reveal}`}>
              <p className={styles.sectionIndex}>
                <span>01</span>
                <span>The room</span>
              </p>
              <h2 id="rental-room-title">
                What you
                <br />
                take over.
              </h2>
            </div>

            <ul className={styles.roomList}>
              {rentalRoom.map((item, index) => (
                <li className={styles.roomRow} key={item.id}>
                  <span className={styles.roomNumber} aria-hidden="true">
                    {(index + 1).toString().padStart(2, "0")}
                  </span>
                  <div className={styles.roomText}>
                    <h3>
                      {item.label}
                      <span lang="ja">{item.japaneseLabel}</span>
                    </h3>
                    <p lang="ja">{item.japanese}</p>
                  </div>
                  <span className={styles.roomRule} aria-hidden="true" />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------ uses ------------------------------ */}
        <section className={styles.uses} aria-labelledby="rental-uses-title">
          <div className={`${styles.head} ${styles.usesHead} ${styles.reveal}`}>
            <p className={styles.sectionIndex}>
              <span>02</span>
              <span>Enquiries</span>
            </p>
            <h2 id="rental-uses-title">
              Four kinds
              <br />
              of enquiry.
            </h2>
            <p className={styles.usesLead} lang="ja">下記のようなご利用について、ご相談を承っています。可否と料金は内容によって変わりますので、まずはお聞かせください。</p>
          </div>

          <ul className={styles.useGrid}>
            {rentalUses.map((use) => (
              <li className={styles.useCard} key={use.id}>
                <div className={styles.useFrame}>
                  <Image
                    className={styles.useImage}
                    src={use.image.src}
                    alt={use.image.alt}
                    fill
                    sizes="(max-width: 700px) 88vw, (max-width: 1180px) 44vw, 23vw"
                    style={framePosition(use.image.position)}
                  />
                  <span className={styles.useWash} aria-hidden="true" />
                </div>
                <h3 className={styles.useTitle}>
                  {use.label}
                  <span lang="ja">{use.japaneseLabel}</span>
                </h3>
                <p className={styles.useText} lang="ja">
                  {use.japanese}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------ close ------------------------------ */}
        {/* The door. The call is the dominant object; the photograph is a
            framed plate beside it, not a full-bleed field the type has to
            survive; and the three steps sit under the button as one ruled
            timeline answering "what happens if I press it". */}
        <section className={styles.close} aria-labelledby="rental-close-title">
          <div className={styles.closeGrid}>
            <div className={styles.closeBody}>
              <div className={`${styles.closeCta} ${styles.reveal}`}>
                <h2 id="rental-close-title" lang="ja">
                  <span className={styles.closeLine}>詳細は、</span>
                  <span className={styles.closeLine}>
                    <span className={styles.closeAccent}>CONTACT</span>
                    <span className={styles.closeParticle}>へ</span>
                  </span>
                </h2>

                {/* Deliberately says something the steps below do not: the
                    steps already carry "ご希望日・ご人数・ご利用内容". */}
                <p className={styles.closeLead} lang="ja">
                  空き状況の確認から、当日の進行のご相談まで。
                  <br className={styles.closeBreak} />
                  フォームからでも、お電話でも承ります。
                </p>

                <div className={styles.closeActions}>
                  <button className="pure-cta" type="button" onClick={openContact}>
                    <span>Open contact</span>
                    <CtaMark />
                  </button>
                  <a className="pure-cta is-ghost" href={PHONE_HREF}>
                    <span>Call {PHONE_NUMBER}</span>
                    <CtaMark />
                  </a>
                </div>
              </div>

              <ol className={styles.steps}>
                {rentalSteps.map((step, index) => (
                  <li className={styles.step} key={step.label}>
                    <span className={styles.stepTick} aria-hidden="true" />
                    <span className={styles.stepIndex} aria-hidden="true">
                      {(index + 1).toString().padStart(2, "0")}
                    </span>
                    <h3>
                      {step.label}
                      <span lang="ja">{step.japaneseLabel}</span>
                    </h3>
                    <p lang="ja">{step.japanese}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className={styles.closeMedia}>
              <div className={styles.closeFrame}>
                <Image
                  className={styles.closeImage}
                  src="/pure/vip/procession.webp"
                  alt="スパークラーを灯したボトルとバースデーサインを掲げるPUREのスタッフ"
                  fill
                  sizes="(max-width: 1000px) 92vw, 34vw"
                  style={framePosition("52% 44%")}
                />
                <span className={styles.closeWash} aria-hidden="true" />
              </div>
            </div>
          </div>

          <footer className={styles.footer}>
            <span>PURE OSAKA</span>
            <Link href="/access">Shinsaibashi / Osaka</Link>
            <span className={styles.year}>© {new Date().getFullYear()}</span>
          </footer>
        </section>
      </main>

      <ClubRaiaMenu isContactOpen={isContactOpen} onContact={openContact} />
      {isContactOpen ? (
        <TheCrossContact
          onClose={closeContact}
          defaultTopic={RENTAL_CONTACT_TOPIC}
        />
      ) : null}
    </>
  );
}
