"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";

import { ClubRaiaMenu } from "@/components/ClubRaiaMenu";
import { CtaMark } from "@/components/CtaMark";
import { TheCrossContact } from "@/components/TheCrossContact";
import { PHONE_HREF, PHONE_NUMBER } from "@/lib/qa-data";

import styles from "./RentalComingSoon.module.css";

/** Matches an <option> in TheCrossContact exactly, so the form opens ready. */
const CONTACT_TOPIC = "Venue rental / private event";

/**
 * PURE Osaka venue hire — the room before the night.
 *
 * Governing concept: this page has nothing to sell yet, so it sells the
 * room. One frame of the floor at full bleed, the word held in the lower
 * left where the photograph is already dark, and a status line that says
 * plainly what is missing. The single moving thing is the hairline that
 * draws under the title — the same 1px gesture /vip rules its prices with
 * and the menu draws under a tile label.
 *
 * Nothing here invents terms, capacities or prices: until the venue writes
 * them, the honest page is a door and a telephone number.
 */
export function RentalComingSoon() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const openContact = useCallback(() => setIsContactOpen(true), []);
  const closeContact = useCallback(() => setIsContactOpen(false), []);

  return (
    <>
      <main className={styles.page}>
        <a className={styles.skipLink} href="#rental-title">
          Skip to the details
        </a>

        <section className={styles.stage} aria-labelledby="rental-title">
          <div className={styles.frame}>
            <Image
              className={styles.photo}
              src="/pure/rental/room-2400.webp"
              alt="PURE Osakaのフロア全景。DJブースから客席とバックバーまでを見渡した様子。"
              fill
              sizes="100vw"
              priority
            />
            <span className={styles.grade} aria-hidden="true" />
            <span className={styles.scrim} aria-hidden="true" />
          </div>

          <p className={styles.status}>
            <span className={styles.statusDot} aria-hidden="true" />
            Coming soon
          </p>

          <div className={styles.copy}>
            <p className={styles.eyebrow}>
              <span>PURE Osaka</span>
              <span className={styles.eyebrowRule} aria-hidden="true" />
              <span>Venue hire</span>
            </p>

            <h1 className={styles.title} id="rental-title">
              <span className={styles.titleWord}>Rental</span>
              <span className={styles.titleJa} lang="ja">
                会場レンタル・貸切
              </span>
            </h1>

            <span className={styles.rule} aria-hidden="true" />

            <p className={styles.lead} lang="ja">
              貸切・イベントでのご利用のご案内は、ただいま準備中です。
              {/* Authored break at the sentence, dropped on a narrow plate
                  where it would only orphan the last two syllables. */}
              <br className={styles.wideBreak} />
              詳細が決まりしだい、このページでお知らせします。
            </p>

            <p className={styles.aside} lang="ja">
              お急ぎのご相談は、お問い合わせまたはお電話で承ります。
            </p>

            <div className={styles.actions}>
              <button
                className="pure-cta"
                type="button"
                onClick={openContact}
              >
                <span>Send an enquiry</span>
                <CtaMark />
              </button>
              <a className="pure-cta is-ghost" href={PHONE_HREF}>
                <span>Call {PHONE_NUMBER}</span>
                <CtaMark />
              </a>
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
        <TheCrossContact onClose={closeContact} defaultTopic={CONTACT_TOPIC} />
      ) : null}
    </>
  );
}
