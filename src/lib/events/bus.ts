// LEGION Type-safe Event Bus

import { LegionEvent, LegionEventType } from "@/types/events";

export type EventListener<T extends LegionEvent = LegionEvent> = (event: T) => void;

class LegionEventBus {
  private listeners: Map<string, Set<EventListener<any>>> = new Map();
  private wildcardListeners: Set<EventListener<LegionEvent>> = new Set();
  private eventHistory: LegionEvent[] = [];
  private maxHistorySize = 500;

  /**
   * Subscribe to a specific event type
   */
  public subscribe<T extends LegionEvent>(
    eventType: T["type"] | "*",
    listener: EventListener<T>
  ): () => void {
    if (eventType === "*") {
      this.wildcardListeners.add(listener as EventListener<LegionEvent>);
      return () => {
        this.wildcardListeners.delete(listener as EventListener<LegionEvent>);
      };
    }

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const set = this.listeners.get(eventType)!;
    set.add(listener);

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  /**
   * Emit an event across all listeners
   */
  public emit<T extends LegionEvent>(event: T): void {
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
  }
}

// Global Singleton Instance
export const legionEventBus = new LegionEventBus();
