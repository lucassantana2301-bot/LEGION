// LEGION Type-safe Event Bus

import { LegionEvent, LegionEventType } from "@/types/events";

export type EventListener<T extends LegionEvent = LegionEvent> = (event: T) => void;

// A plain Omit<T, K> over a union type collapses to the shared base fields
// instead of omitting K from each member — this distributes it per-member so
// callers still get full autocomplete/checking for their specific event type.
export type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

export interface SubscribeOptions {
  /** When set, the listener only receives events for this mission. */
  missionId?: string;
}

class LegionEventBus {
  private listeners: Map<string, Set<EventListener<any>>> = new Map();
  private wildcardListeners: Set<EventListener<LegionEvent>> = new Set();
  private eventHistory: LegionEvent[] = [];
  private maxHistorySize = 500;
  private seqCounter = 0;

  /**
   * Generates a collision-resistant event ID within this session
   * (timestamp + monotonic counter, unlike a bare Date.now() call).
   */
  private generateId(prefix: string, seq: number): string {
    return `${prefix}_${Date.now()}_${seq}`;
  }

  /**
   * Subscribe to a specific event type. Pass options.missionId to only
   * receive events scoped to that mission.
   */
  public subscribe<T extends LegionEvent>(
    eventType: T["type"] | "*",
    listener: EventListener<T>,
    options?: SubscribeOptions
  ): () => void {
    const effectiveListener: EventListener<T> = options?.missionId
      ? (event) => {
          if (event.missionId === options.missionId) {
            listener(event);
          }
        }
      : listener;

    if (eventType === "*") {
      this.wildcardListeners.add(effectiveListener as EventListener<LegionEvent>);
      return () => {
        this.wildcardListeners.delete(effectiveListener as EventListener<LegionEvent>);
      };
    }

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const set = this.listeners.get(eventType)!;
    set.add(effectiveListener);

    return () => {
      set.delete(effectiveListener);
      if (set.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  /**
   * Emit an event across all listeners. The bus is the single source of
   * truth for `id`, `timestamp`, and `seq` — callers only supply the
   * semantic payload, which guarantees every event is uniquely and
   * monotonically identifiable regardless of call site.
   */
  public emit<T extends LegionEvent>(eventInput: DistributiveOmit<T, "id" | "timestamp" | "seq">): void {
    this.seqCounter += 1;
    const seq = this.seqCounter;
    const prefix = (eventInput as { type: LegionEventType }).type === "TERMINAL_OUTPUT" ? "term" : "evt";
    const event = {
      ...eventInput,
      id: this.generateId(prefix, seq),
      timestamp: new Date().toISOString(),
      seq,
    } as unknown as T;

    // Record in memory history
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.pop();
    }

    // Call wildcard subscribers
    for (const listener of this.wildcardListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error(`[LegionEventBus] Wildcard listener error:`, err);
      }
    }

    // Call specific event type subscribers
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        try {
          listener(event);
        } catch (err) {
          console.error(`[LegionEventBus] Listener error for ${event.type}:`, err);
        }
      }
    }
  }

  /**
   * Get recent recorded events
   */
  public getHistory(limit?: number): LegionEvent[] {
    return limit ? this.eventHistory.slice(0, limit) : [...this.eventHistory];
  }

  /**
   * Clear all history and listeners
   */
  public reset(): void {
    this.listeners.clear();
    this.wildcardListeners.clear();
    this.eventHistory = [];
    this.seqCounter = 0;
  }
}

// Global Singleton Instance
export const legionEventBus = new LegionEventBus();
