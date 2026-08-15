"use client";

import { useCallback, useState } from "react";

import { ClubRaiaMenu } from "@/components/ClubRaiaMenu";
import { TheCrossContact } from "@/components/TheCrossContact";

type SiteNavProps = {
  /** Preselects the enquiry topic when the contact panel opens. */
  contactTopic?: string;
};

/**
 * The site navigation plus the contact overlay it owns.
 *
 * The four experience routes each hold this pair inline because they also
 * drive it from their own CTAs. Server-rendered routes have no client
 * boundary of their own, so they mount this instead of shipping no
 * navigation at all: `/access` previously offered only "Back to home",
 * which made the one page a visitor reaches from a search result a dead
 * end for every other room.
 */
export function SiteNav({ contactTopic }: SiteNavProps) {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const openContact = useCallback(() => setIsContactOpen(true), []);
  const closeContact = useCallback(() => setIsContactOpen(false), []);

  return (
    <>
      <ClubRaiaMenu isContactOpen={isContactOpen} onContact={openContact} />
      {isContactOpen ? (
        <TheCrossContact onClose={closeContact} defaultTopic={contactTopic} />
      ) : null}
    </>
  );
}
