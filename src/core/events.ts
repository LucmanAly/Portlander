/** Minimal typed pub/sub used for in-process module decoupling — e.g. the
 *  earnings watcher emits `earnings.upcoming` and the notifications module
 *  is the only listener, without either module importing the other. */

export type EarningsUpcomingEvent = {
  userId: string;
  symbol: string;
  eventDate: string; // YYYY-MM-DD
  leadDays: number;
};

export type EventMap = {
  "earnings.upcoming": EarningsUpcomingEvent;
};

type Listener<K extends keyof EventMap> = (payload: EventMap[K]) => void | Promise<void>;

class EventBus {
  private listeners: { [K in keyof EventMap]?: Listener<K>[] } = {};

  on<K extends keyof EventMap>(event: K, listener: Listener<K>): void {
    (this.listeners[event] ??= []).push(listener as never);
  }

  async emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): Promise<void> {
    const handlers = this.listeners[event] ?? [];
    for (const handler of handlers) {
      await handler(payload);
    }
  }
}

export const eventBus = new EventBus();
