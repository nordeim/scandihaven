import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { OrderConfirmation, ShipmentUpdate } from "./templates";

/**
 * Email transport (PRD §4.5, FR-910): Resend when RESEND_API_KEY is set,
 * otherwise a structured log transport so local dev never silently drops mail.
 * Templates render via react-dom/server (stable API, no vendor render magic).
 */
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export type SendResult = { transport: "resend" | "log"; id: string | null };

async function renderAndSend(
  template: "order-confirmation" | "shipment-update",
  to: string,
  subject: string,
  element: ReactElement,
): Promise<SendResult> {
  const html = `<!DOCTYPE html>${renderToStaticMarkup(element)}`;
  if (!resend) {
    console.info(`[email:log] template=${template} to=${hashEmail(to)} subject="${subject}"`);
    return { transport: "log", id: null };
  }
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Scandi Haven <orders@scandihaven.example>",
    to,
    subject,
    html,
  });
  if (error) {
    // Surface actionable failure; caller logs with correlation id (PRD §4.5).
    throw new Error(`Resend ${template} send failed: ${error.message}`);
  }
  return { transport: "resend", id: data?.id ?? null };
}

/** PII scrubbing (PRD §9.5): logs carry hashed recipients, never raw addresses. */
function hashEmail(email: string): string {
  let hash = 5381;
  for (const byte of Buffer.from(email.toLowerCase())) {
    hash = ((hash << 5) + hash + byte) >>> 0;
  }
  return `sha1-style:${hash.toString(16)}`;
}

export async function sendOrderConfirmation(props: {
  to: string;
  orderNumber: string;
  customerName: string;
  totalFormatted: string;
  leadTimeNote: string;
  siteUrl: string;
}): Promise<SendResult> {
  return renderAndSend(
    "order-confirmation",
    props.to,
    `Order ${props.orderNumber} confirmed`,
    OrderConfirmation(props),
  );
}

export async function sendShipmentUpdate(props: {
  to: string;
  orderNumber: string;
  trackingUrl: string | null;
  carrier: string | null;
}): Promise<SendResult> {
  return renderAndSend(
    "shipment-update",
    props.to,
    `Your order ${props.orderNumber} has shipped`,
    ShipmentUpdate(props),
  );
}
