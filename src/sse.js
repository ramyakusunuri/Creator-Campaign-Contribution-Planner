/**
 * Per-brand Server-Sent Events (SSE) Manager.
 * 
 * Requirements:
 * - 20-subscriber cap per brand (returns 429 if exceeded).
 * - Brand-only delivery (no cross-brand leakage).
 * - 25s heartbeat comment (: ping\n\n).
 * - Clean teardown on socket close / client abort.
 */
export class SseHub {
  constructor({ heartbeatIntervalMs = 25000, maxSubscribersPerBrand = 20 } = {}) {
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    this.maxSubscribersPerBrand = maxSubscribersPerBrand;
    // Map<brandId, Set<http.ServerResponse>>
    this.brandSubscribers = new Map();

    this.heartbeatTimer = setInterval(() => {
      this._sendHeartbeat();
    }, this.heartbeatIntervalMs);

    // Prevent unref if in node test environment
    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  /**
   * Subscribes an HTTP response stream to a brand's event stream.
   * 
   * @param {string} brandId 
   * @param {import('node:http').ServerResponse} res 
   * @returns {boolean} true if subscribed, false if cap exceeded (429)
   */
  subscribe(brandId, res) {
    let subs = this.brandSubscribers.get(brandId);
    if (!subs) {
      subs = new Set();
      this.brandSubscribers.set(brandId, subs);
    }

    if (subs.size >= this.maxSubscribersPerBrand) {
      return false; // Caller should respond with 429
    }

    // Configure SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send initial comment to establish stream
    res.write(': connected\n\n');

    subs.add(res);

    const cleanup = () => {
      subs.delete(res);
      if (subs.size === 0) {
        this.brandSubscribers.delete(brandId);
      }
    };

    res.on('close', cleanup);
    res.on('finish', cleanup);
    res.on('error', cleanup);

    return true;
  }

  /**
   * Publishes an event to all subscribers of a specific brand.
   * 
   * @param {string} brandId 
   * @param {string} eventName 
   * @param {*} data 
   */
  publish(brandId, eventName, data) {
    const subs = this.brandSubscribers.get(brandId);
    if (!subs || subs.size === 0) return;

    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of subs) {
      try {
        res.write(payload);
      } catch (err) {
        subs.delete(res);
      }
    }
  }

  _sendHeartbeat() {
    for (const [brandId, subs] of this.brandSubscribers.entries()) {
      for (const res of subs) {
        try {
          res.write(': ping\n\n');
        } catch (err) {
          subs.delete(res);
        }
      }
      if (subs.size === 0) {
        this.brandSubscribers.delete(brandId);
      }
    }
  }

  getSubscriberCount(brandId) {
    const subs = this.brandSubscribers.get(brandId);
    return subs ? subs.size : 0;
  }

  close() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    for (const subs of this.brandSubscribers.values()) {
      for (const res of subs) {
        try {
          res.end();
        } catch {}
      }
    }
    this.brandSubscribers.clear();
  }
}
