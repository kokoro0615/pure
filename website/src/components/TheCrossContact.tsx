"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

type TheCrossContactProps = {
  onClose: () => void;
};

export function TheCrossContact({ onClose }: TheCrossContactProps) {
  const [sent, setSent] = useState(false);

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  return (
    <main className="the-cross-contact">
      <section className="the-cross-contact__panel" aria-labelledby="contact-heading">
        <button
          className="the-cross-contact__close"
          type="button"
          aria-label="Return to home"
          onClick={onClose}
        >
          <Image src="/the-cross/close.svg" alt="" width={15} height={15} priority />
        </button>

        <div className="the-cross-contact__grid">
          <div className="the-cross-contact__intro">
            <h1 id="contact-heading" className="the-cross-contact__title">
              <span>CONTACT</span>
            </h1>
            <a className="the-cross-contact__address" href="https://maps.google.com/?q=2-3-12+Shinsaibashisuji+Chuo-ku+Osaka+542-0085" target="_blank" rel="noreferrer">
              2-3-12, Shinsaibashisuji<br />
              Chuo-ku, Osaka 542-0085
            </a>
          </div>

          <form className="the-cross-contact__form" onSubmit={submitForm}>
            <label>
              <span>FULL NAME</span>
              <input name="name" aria-label="Full name" autoComplete="name" placeholder="YOUR NAME" required />
            </label>
            <label>
              <span>EMAIL ADDRESS</span>
              <input name="email" aria-label="Email address" type="email" autoComplete="email" placeholder="YOUR EMAIL ADDRESS" required />
            </label>
            <label>
              <span>ENQUIRY</span>
              <select name="enquiryType" aria-label="Enquiry topic" defaultValue="" required>
                <option value="" disabled>SELECT A TOPIC</option>
                <option>VIP TABLE RESERVATION</option>
                <option>VENUE RENTAL / PRIVATE EVENT</option>
                <option>EVENT / DJ BOOKING</option>
                <option>MEDIA / PARTNERSHIP</option>
                <option>GENERAL ENQUIRY</option>
              </select>
            </label>
            <label className="the-cross-contact__message">
              <span>DETAILS</span>
              <textarea name="message" aria-label="Enquiry details" placeholder="DATE, GROUP SIZE, AND YOUR REQUEST" required />
            </label>
            <button className="the-cross-contact__send" type="submit">
              <span>SEND</span>
              <Image src="/the-cross/arrow.svg" alt="" width={24} height={24} />
            </button>
            {sent && <p className="the-cross-contact__success" role="status">Thank you — your message has been sent.</p>}
            <p className="the-cross-contact__note">For VIP tables and private events, please include your preferred date and group size.</p>
          </form>
        </div>
      </section>
    </main>
  );
}
