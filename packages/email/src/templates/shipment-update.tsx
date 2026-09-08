import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export type ShipmentUpdateProps = {
  orderNumber: string;
  trackingUrl: string | null;
  carrier: string | null;
}

export function ShipmentUpdate({ orderNumber, trackingUrl, carrier }: ShipmentUpdateProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your order {orderNumber} has shipped</Preview>
      <Body style={{ backgroundColor: "#FAF7F2", fontFamily: "Georgia, serif", margin: 0 }}>
        <Container style={{ backgroundColor: "#FFFFFF", margin: "24px auto", maxWidth: "560px", padding: "32px", borderRadius: "2px" }}>
          <Heading style={{ color: "#1F1B17", fontSize: 24, fontWeight: 400, margin: "0 0 8px" }}>
            Your order is on its way
          </Heading>
          <Text style={{ color: "#4A433B", fontSize: 15, lineHeight: 1.6 }}>
            Order <strong>{orderNumber}</strong> has shipped{carrier ? ` with ${carrier}` : ""}.
          </Text>
          {trackingUrl ? (
            <Text style={{ fontSize: 15 }}>
              Track it here:{" "}
              <a href={trackingUrl} style={{ color: "#B06548" }}>
                {trackingUrl}
              </a>
            </Text>
          ) : (
            <Text style={{ color: "#8A8178", fontSize: 13 }}>
              Tracking details will follow once the carrier scans your parcel.
            </Text>
          )}
          <Hr style={{ borderColor: "#E5DDD1", margin: "24px 0" }} />
          <Text style={{ color: "#8A8178", fontSize: 12 }}>Scandi Haven · Aalborg, Denmark</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ShipmentUpdate;
