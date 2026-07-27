"use client";

import { useCallback, useState } from "react";
import { Hero } from "@/components/Hero";
import { ClubRaiaMenu } from "@/components/ClubRaiaMenu";
import { TheCrossContact } from "@/components/TheCrossContact";

export default function Home() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const openContact = useCallback(() => setIsContactOpen(true), []);
  const closeContact = useCallback(() => setIsContactOpen(false), []);

  return (
    <>
      <ClubRaiaMenu onContact={openContact} />
      <main>
        <Hero />
      </main>
      {isContactOpen ? <TheCrossContact onClose={closeContact} /> : null}
    </>
  );
}
