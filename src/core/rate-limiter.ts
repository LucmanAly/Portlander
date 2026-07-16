/** Simple in-memory token-bucket rate limiter, one bucket per provider name.
 *
 *  Note: this resets on every cold start, which is the right trade-off for a
 *  serverless deployment — it exists to keep a single invocation from
 *  bursting past a provider's per-minute limit, not to track usage across
 *  the day (the DB cache is what keeps daily call counts low). */

type Bucket = {
  tokens: number;
  capacity: number;
  refillPerMs: number;
  lastRefill: number;
};

class RateLimiter {
  private buckets = new Map<string, Bucket>();

  private getBucket(name: string, capacity: number, perSeconds: number): Bucket {
    let bucket = this.buckets.get(name);
    if (!bucket) {
      bucket = {
        tokens: capacity,
        capacity,
        refillPerMs: capacity / (perSeconds * 1000),
        lastRefill: Date.now(),
      };
      this.buckets.set(name, bucket);
    }
    return bucket;
  }

  /** Returns true and consumes a token if the provider is under its limit. */
  tryConsume(name: string, capacity: number, perSeconds: number): boolean {
    const bucket = this.getBucket(name, capacity, perSeconds);
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.refillPerMs);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }
}

export const rateLimiter = new RateLimiter();
