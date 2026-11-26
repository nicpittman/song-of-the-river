/** Minimal typed event emitter. */
export class Emitter<Events extends object> {
  private listeners: { [K in keyof Events]?: Array<(payload: Events[K]) => void> } = {};

  on<K extends keyof Events>(type: K, fn: (payload: Events[K]) => void): () => void {
    (this.listeners[type] ??= []).push(fn);
    return () => {
      const list = this.listeners[type];
      if (list) this.listeners[type] = list.filter((f) => f !== fn);
    };
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    for (const fn of this.listeners[type] ?? []) fn(payload);
  }
}
