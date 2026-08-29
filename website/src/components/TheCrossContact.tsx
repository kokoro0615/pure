"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";

import { CtaMark } from "@/components/CtaMark";

const VENUE_EMAIL = "pureosaka2005@gmail.com";
const VENUE_TEL = "06-6214-6600";
const VENUE_TEL_HREF = "tel:+81662146600";

const ENQUIRY_TOPICS = [
  "VIP table reservation",
  "Venue rental / private event",
  "Event / DJ booking",
  "Media / partnership",
  "General enquiry",
] as const;

type TheCrossContactProps = {
  onClose: () => void;
  /** Preselects the enquiry topic when the panel is opened from a page that
      already knows what the visitor came for (e.g. the VIP set menu). */
  defaultTopic?: string;
};

export function TheCrossContact({ onClose, defaultTopic = "" }: TheCrossContactProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef<Element | null>(null);
  const [status, setStatus] = useState<"idle" | "handoff">("idle");
  const fieldId = useId();

  /* The overlay covers the whole viewport, so it has to behave like the
     dialog it looks like: focus enters on open, Escape closes, Tab is
     trapped inside, and focus returns to whatever opened it. None of that
     existed before, which left keyboard users with no way out. */
  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    const raf = window.requestAnimationFrame(() => closeRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(raf);
      const target = returnFocusRef.current;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      /* Deferred by a frame. Focusing synchronously here is clobbered by
         the browser's own focus reset for the panel's removed node, which
         lands on <body>: keyboard users closing the panel were dropped at
         the top of the document instead of back on the control they came
         from. */
      window.requestAnimationFrame(() => target.focus());
    };
  }, []);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const topic = String(formData.get("enquiryType") ?? "");
    const message = String(formData.get("message") ?? "");
    const subject = `PURE CONTACT: ${topic}`;
    const body = [
      `Full name: ${name}`,
      `Reply email: ${email}`,
      `Topic: ${topic}`,
      "",
      "Message:",
      message,
    ].join("\n");

    /* This hands off to the visitor's mail client. If none is registered
       nothing visibly happens, so say so and keep the address and phone
       number on screen rather than failing silently. */
    setStatus("handoff");
    window.location.href =
      `mailto:${VENUE_EMAIL}?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
  }

  return (
    <div
      className="the-cross-contact"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-heading"
      onKeyDown={handleKeyDown}
    >
      <section className="the-cross-contact__panel" ref={panelRef}>
        <button
          ref={closeRef}
          className="the-cross-contact__close"
          type="button"
          aria-label="Close contact"
          onClick={onClose}
        >
          <Image src="/the-cross/close.svg" alt="" width={15} height={15} priority />
        </button>

        <div className="the-cross-contact__grid">
          <div className="the-cross-contact__intro">
            <h2 id="contact-heading" className="the-cross-contact__title">
              CONTACT
            </h2>

            <p className="the-cross-contact__standfirst" lang="ja">
              VIPテーブル、貸切、出演、取材のご相談。
              <br />
              お急ぎの場合はお電話ください。
            </p>

            <dl className="the-cross-contact__direct">
              <div>
                <dt>Telephone</dt>
                <dd>
                  <a href={VENUE_TEL_HREF}>{VENUE_TEL}</a>
                </dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${VENUE_EMAIL}`}>{VENUE_EMAIL}</a>
                </dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>
                  <a
                    href="https://maps.google.com/?q=2-3-12+Shinsaibashisuji+Chuo-ku+Osaka+542-0085"
                    target="_blank"
                    rel="noreferrer"
                  >
                    2-3-12, Shinsaibashisuji
                    <br />
                    Chuo-ku, Osaka 542-0085
                  </a>
                </dd>
              </div>
            </dl>
          </div>

          <form className="the-cross-contact__form" onSubmit={submitForm}>
            <div className="the-cross-contact__field">
              <label htmlFor={`${fieldId}-name`}>Full name</label>
              <input
                id={`${fieldId}-name`}
                name="name"
                autoComplete="name"
                required
              />
            </div>

            <div className="the-cross-contact__field">
              <label htmlFor={`${fieldId}-email`}>Email address</label>
              <input
                id={`${fieldId}-email`}
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>

            <div className="the-cross-contact__field">
              <label htmlFor={`${fieldId}-topic`}>Enquiry</label>
              <select
                id={`${fieldId}-topic`}
                name="enquiryType"
                defaultValue={defaultTopic}
                required
              >
                <option value="" disabled>
                  Select a topic
                </option>
                {ENQUIRY_TOPICS.map((topic) => (
                  <option key={topic}>{topic}</option>
                ))}
              </select>
            </div>

            <div className="the-cross-contact__field">
              <label htmlFor={`${fieldId}-message`}>Details</label>
              <textarea
                id={`${fieldId}-message`}
                name="message"
                className="the-cross-contact__message"
                aria-describedby={`${fieldId}-hint`}
                required
              />
              <p className="the-cross-contact__hint" id={`${fieldId}-hint`}>
                For VIP tables and private events, include your date and group size.
              </p>
            </div>

            <button className="pure-cta" type="submit">
              <span>Send enquiry</span>
              <CtaMark />
            </button>

            <p className="the-cross-contact__status" role="status">
              {status === "handoff"
                ? `Opening your mail app. If nothing happens, write to ${VENUE_EMAIL} or call ${VENUE_TEL}.`
                : ""}
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
