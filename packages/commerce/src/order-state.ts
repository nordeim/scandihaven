/**
 * Order state machine (PRD §7.7) — the only writer of order.status is
 * `transition()`. Illegal moves throw; every move is pure and testable.
 */

export const ORDER_STATUSES = [
  "pending_payment",
  "review",
  "confirmed",
  "in_production",
  "partially_shipped",
  "shipped",
  "delivered",
  "closed",
  "cancelled",
  "refunded",
  "partially_refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_EVENTS = [
  "payment_succeeded",
  "flag_for_review",
  "release_to_production",
  "start_production",
  "mark_partially_shipped",
  "mark_shipped",
  "mark_delivered",
  "close",
  "cancel",
  "refund_full",
  "refund_partial",
] as const;

export type OrderEvent = (typeof ORDER_EVENTS)[number];

export class InvalidOrderTransition extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly event: OrderEvent,
  ) {
    super(`Illegal order transition: ${event} from ${from}`);
    this.name = "InvalidOrderTransition";
  }
}

/** Event → set of allowed source statuses. */
const TRANSITIONS: Record<OrderEvent, readonly OrderStatus[]> = {
  payment_succeeded: ["pending_payment"],
  flag_for_review: ["pending_payment"],
  release_to_production: ["review"],
  start_production: ["confirmed", "review"],
  mark_partially_shipped: ["confirmed", "in_production", "partially_shipped", "review"],
  mark_shipped: ["confirmed", "in_production", "partially_shipped", "review"],
  mark_delivered: ["shipped", "partially_shipped"],
  close: ["delivered", "cancelled", "refunded"],
  cancel: ["pending_payment", "confirmed", "in_production", "review"],
  refund_full: [
    "pending_payment",
    "confirmed",
    "in_production",
    "partially_shipped",
    "shipped",
    "delivered",
    "partially_refunded",
    "review",
  ],
  refund_partial: ["confirmed", "in_production", "partially_shipped", "shipped", "delivered"],
};

/** Statuses where the order may no longer be modified by CS. */
const TERMINAL: ReadonlySet<OrderStatus> = new Set(["closed", "refunded"]);

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL.has(status);
}

/** Pure transition: returns the next status or throws InvalidOrderTransition. */
export function transition(current: OrderStatus, event: OrderEvent): OrderStatus {
  const allowed = TRANSITIONS[event];
  if (!allowed.includes(current)) {
    throw new InvalidOrderTransition(current, event);
  }
  switch (event) {
    case "payment_succeeded":
      return "confirmed";
    case "flag_for_review":
      return "review";
    case "release_to_production":
      return "confirmed";
    case "start_production":
      return "in_production";
    case "mark_partially_shipped":
      return "partially_shipped";
    case "mark_shipped":
      return "shipped";
    case "mark_delivered":
      return "delivered";
    case "close":
      return "closed";
    case "cancel":
      return "cancelled";
    case "refund_full":
      return "refunded";
    case "refund_partial":
      return "partially_refunded";
  }
}
