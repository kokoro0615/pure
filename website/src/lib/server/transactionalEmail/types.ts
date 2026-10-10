export type TransactionalEmailTag = Readonly<{
  name: "purpose" | "notification_job_id";
  value: string;
}>;

export type TransactionalEmailMessage = Readonly<{
  from: string;
  recipient: string;
  replyTo: string | null;
  subject: string;
  text: string;
  html: string;
  tags: readonly TransactionalEmailTag[];
}>;

type TransactionalEmailRenderBase = {
  recipient: string;
  from: string;
  replyTo: string | null;
  notificationJobId: string;
  renderReferenceAt: string;
};

export type TransactionalEmailRenderCommand =
  | (TransactionalEmailRenderBase & {
    template: "reservation_created" | "reservation_changed";
    templateVersion: "ghost.vip-email.v1";
    publicCode: string;
    scheduledStartAt: string | null;
  })
  | (TransactionalEmailRenderBase & {
    template: "waitlist_called" | "waitlist_recalled";
    templateVersion: "ghost.vip-email.v1";
    publicCode: string;
  })
  | (TransactionalEmailRenderBase & {
    template: "ticket_admission";
    templateVersion: "ghost.ticket-email.v1";
    publicCode: string;
    ticketAccessUrl: string;
  })
  | (TransactionalEmailRenderBase & {
    template: "ticket_wallet_purchase";
    commercial?: import("../../tickets/ticketCommercialTerms").TicketCommercialSnapshot;
    templateVersion: "ghost.ticket-wallet-purchase.v1" | "ghost.ticket-wallet-purchase.v2";
    eventTitle?: string;
    demoAdmissionTest?: boolean;
    publicCode: string;
    eventDate: string;
    totalQuantity: number;
    walletUrl: string;
    orderEntryUrl?: string;
  })
  | (TransactionalEmailRenderBase & {
    template: "ticket_wallet_otp";
    templateVersion: "ghost.ticket-wallet-otp.v1";
    otp: string;
    expiresAt: string;
    walletUrl: string;
  });

/** Ephemeral delivery material. It must never be serialized into an outbox row. */
export type RenderedTransactionalEmail = Readonly<{
  templateVersion: TransactionalEmailRenderCommand["templateVersion"];
  renderReferenceAt: string;
  message: TransactionalEmailMessage;
  payloadHash: string;
}>;
