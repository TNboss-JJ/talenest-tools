const store = new Map();

export function rateLimit({ windowMs, max }) {
  return {
    check(key) {
      const now = Date.now();
      const entry = store.get(key);

      if (!entry || now > entry.resetTime) {
        store.set(key, { count: 1, resetTime: now + windowMs });
        if (store.size > 10000) cleanup(now);
        return { allowed: true, remaining: max - 1, resetTime: now + windowMs };
      }

      if (entry.count >= max) {
        return { allowed: false, remaining: 0, resetTime: entry.resetTime };
      }

      entry.count++;
      return { allowed: true, remaining: max - entry.count, resetTime: entry.resetTime };
    }
  };
}

function cleanup(now) {
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetTime) store.delete(key);
  }
}
