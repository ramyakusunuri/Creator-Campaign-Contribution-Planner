/**
 * Global SSE Hub for Next.js (Node.js runtime).
 * Uses globalThis so the event manager survives Next.js fast-refresh / module re-evaluations.
 */

type StreamController = ReadableStreamDefaultController<Uint8Array>;

interface Subscriber {
  id: string;
  controller: StreamController;
  encoder: TextEncoder;
}

class SseHub {
  private brandSubscribers: Map<string, Set<Subscriber>> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private maxSubscribersPerBrand: number = 20;

  constructor() {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, 25000);

    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  public subscribe(
    brandId: string,
    controller: StreamController,
    signal?: AbortSignal
  ): boolean {
    let subs = this.brandSubscribers.get(brandId);
    if (!subs) {
      subs = new Set();
      this.brandSubscribers.set(brandId, subs);
    }

    if (subs.size >= this.maxSubscribersPerBrand) {
      return false; // Exceeded cap -> 429
    }

    const subscriber: Subscriber = {
      id: Math.random().toString(36).slice(2),
      controller,
      encoder: new TextEncoder()
    };

    subs.add(subscriber);

    // Initial connection comment with retry hint
    try {
      controller.enqueue(subscriber.encoder.encode('retry: 3000\n: connected\n\n'));
    } catch {}

    const cleanup = () => {
      subs?.delete(subscriber);
      if (subs && subs.size === 0) {
        this.brandSubscribers.delete(brandId);
      }
    };

    if (signal) {
      signal.addEventListener('abort', cleanup);
    }

    return true;
  }

  public publish(brandId: string, eventName: string, data: any): void {
    const subs = this.brandSubscribers.get(brandId);
    if (!subs || subs.size === 0) return;

    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const sub of Array.from(subs)) {
      try {
        sub.controller.enqueue(sub.encoder.encode(payload));
      } catch (err) {
        subs.delete(sub);
      }
    }
  }

  private sendHeartbeat(): void {
    for (const [brandId, subs] of this.brandSubscribers.entries()) {
      for (const sub of Array.from(subs)) {
        try {
          sub.controller.enqueue(sub.encoder.encode(': ping\n\n'));
        } catch {
          subs.delete(sub);
        }
      }
      if (subs.size === 0) {
        this.brandSubscribers.delete(brandId);
      }
    }
  }

  public getSubscriberCount(brandId: string): number {
    return this.brandSubscribers.get(brandId)?.size || 0;
  }
}

// Preserve instance across Next.js module re-evaluations
const globalForSse = globalThis as unknown as { __c24_sse_hub?: SseHub };
export const sseHub: SseHub = globalForSse.__c24_sse_hub ?? new SseHub();
if (process.env.NODE_ENV !== 'production') {
  globalForSse.__c24_sse_hub = sseHub;
}

export function getSseHub(): SseHub {
  return sseHub;
}
