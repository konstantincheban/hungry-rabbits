export type EventMap = Record<string, unknown>;

type Listener<T> = (payload: T) => void;

export class EventBus<Events extends EventMap> {
  private readonly listeners = new Map<keyof Events, Set<Listener<unknown>>>();

  public on<K extends keyof Events>(eventName: K, listener: Listener<Events[K]>): () => void {
    const current = this.listeners.get(eventName) ?? new Set<Listener<unknown>>();
    current.add(listener as Listener<unknown>);
    this.listeners.set(eventName, current);

    return () => this.off(eventName, listener);
  }

  public off<K extends keyof Events>(eventName: K, listener: Listener<Events[K]>): void {
    const current = this.listeners.get(eventName);
    if (!current) {
      return;
    }

    current.delete(listener as Listener<unknown>);

    if (current.size === 0) {
      this.listeners.delete(eventName);
    }
  }

  public emit<K extends keyof Events>(eventName: K, payload: Events[K]): void {
    const current = this.listeners.get(eventName);
    if (!current) {
      return;
    }

    current.forEach((listener) => {
      (listener as Listener<Events[K]>)(payload);
    });
  }
}
