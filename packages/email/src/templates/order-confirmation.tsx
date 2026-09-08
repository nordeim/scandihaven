import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export type OrderConfirmationProps = {
  orderNumber: string;
  customerName: string;
  totalFormatted: string;
  leadTimeNote: string;
  siteUrl: string;
}

export function OrderConfirmation({
  orderNumber,
  customerName,
  totalFormatted,
  leadTimeNote,
  siteUrl,
}: OrderConfirmationProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Order {orderNumber} confirmed — thank you</Preview>
      <Body style={{ backgroundColor: "#FAF7F2", fontFamily: "Georgia, serif", margin: 0 }}>
        <Container style={{ backgroundColor: "#FFFFFF", margin: "24px auto", maxWidth: "560px", padding: "32px", borderRadius: "2px" }}>
          <Heading style={{ color: "#1F1B17", fontSize: 24, fontWeight: 400, margin: "0 0 8px" }}>
            Thank you, {customerName}
          </Heading>
          <Text style={{ color: "#4A433B", fontSize: 15, lineHeight: 1.6 }}>
            Your order <strong>{orderNumber}</strong> is confirmed. {leadTimeNote}
          </Text>
          <Hr style={{ borderColor: "#E5DDD1", margin: "24px 0" }} />
          <Text style={{ color: "#1F1B17", fontSize: 18 }}>
            Total: {totalFormatted}
          </Text>
          <Button
            href={`${siteUrl}/account/orders`}
            style={{ backgroundColor: "#B06548", borderRadius: 2, color: "#fff", display: "inline-block", fontSize: 14, marginTop: 16, padding: "12px 24px", textDecoration: "none" }}
          >
            View your order
          </Button>
          <Hr style={{ borderColor: "#E5DDD1", margin: "24px 0" }} />
          <Text style={{ color: "#8A8178", fontSize: 12 }}>
            Scandi Haven · Aalborg, Denmark · Made slowly, kept for decades.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default OrderConfirmation;
