import { describe, expect, it } from "vitest";
import { InvalidOrderTransition, isTerminal, transition } from "./order-state";

describe("order state machine (PRD §7.7)", () => {
  it("walks the happy path", () => {
    const steps: Array<[Parameters<typeof transition>[0], Parameters<typeof transition>[1]]> = [
      ["pending_payment", "payment_succeeded"],
      ["confirmed", "mark_shipped"],
      ["shipped", "mark_delivered"],
      ["delivered", "close"],
    ];
    let status: ReturnType<typeof transition> = "pending_payment";
    for (const [from, event] of steps) {
      expect(status).toBe(from);
      status = transition(status, event);
    }
    expect(status).toBe("closed");
  });

  it("rejects payment success on a confirmed order (double-webhook safety)", () => {
    expect(() => transition("confirmed", "payment_succeeded")).toThrow(InvalidOrderTransition);
  });

  it("rejects cancelling a shipped order", () => {
    expect(() => transition("shipped", "cancel")).toThrow(InvalidOrderTransition);
  });

  it("routes through review and back to production", () => {
    expect(transition("pending_payment", "flag_for_review")).toBe("review");
    expect(transition("review", "release_to_production")).toBe("confirmed");
    expect(transition("review", "start_production")).toBe("in_production");
  });

  it("allows partial refunds after delivery", () => {
    expect(transition("delivered", "refund_partial")).toBe("partially_refunded");
  });

  it("marks terminal states", () => {
    expect(isTerminal("closed")).toBe(true);
    expect(isTerminal("refunded")).toBe(true);
    expect(isTerminal("delivered")).toBe(false);
  });

  it("every (status, event) pair either transitions or throws InvalidOrderTransition — nothing else", () => {
    const statuses = [
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
    const events = [
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
    for (const status of statuses) {
      for (const event of events) {
        try {
          const next = transition(status, event);
          expect(next).toBeDefined();
        } catch (error) {
          // Totality: the only legal failure mode is a typed invalid transition.
          expect(error).toBeInstanceOf(InvalidOrderTransition);
        }
      }
    }
  });
});
