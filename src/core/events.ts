type Handler = (payload: any) => void;

/** Very small event bus so systems stay decoupled. */
export class EventBus {
  private map = new Map<string, Handler[]>();
  on(name: string, fn: Handler): void {
    const list = this.map.get(name) ?? [];
    list.push(fn);
    this.map.set(name, list);
  }
  emit(name: string, payload?: any): void {
    const list = this.map.get(name);
    if (list) for (const fn of list) fn(payload);
  }
}

export const bus = new EventBus();
