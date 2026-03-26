/**
 * lib/rate-limit.js
 * TaleNest Internal Tools — Rate Limiter
 *
 * ⚠️  Vercel Serverless 주의사항:
 * 메모리 기반이라 인스턴스가 다르면 공유가 안 됨.
 * 즉, 엄격한 글로벌 제한은 아니고 "인스턴스당" 제한.
 * 1인 사용자 도구이므로 충분히 실용적.
 * 추후 엄격한 제한이 필요하면 Redis/Upstash로 교체 권장.
 */

const store = new Map(); // { key → [timestamps] }
const MAX_STORE_SIZE = 10_000;

/**
 * @param {{ windowMs: number, max: number }} options
 * @returns {{ check: (key: string) => { allowed: boolean, remaining: number, resetAt: number } }}
 */
export function rateLimit({ windowMs = 60_000, max = 30 } = {}) {
  return {
    check(key) {
      const now = Date.now();
      const windowStart = now - windowMs;

      // 만료된 키 정리 (메모리 누수 방지)
      if (store.size > MAX_STORE_SIZE) {
        for (const [k, timestamps] of store) {
          const valid = timestamps.filter((t) => t > windowStart);
          if (valid.length === 0) store.delete(k);
          else store.set(k, valid);
        }
      }

      const timestamps = (store.get(key) ?? []).filter((t) => t > windowStart);

      if (timestamps.length >= max) {
        const resetAt = Math.min(...timestamps) + windowMs;
        return { allowed: false, remaining: 0, resetAt };
      }

      timestamps.push(now);
      store.set(key, timestamps);

      return {
        allowed: true,
        remaining: max - timestamps.length,
        resetAt: now + windowMs,
      };
    },
  };
}

/**
 * IP 주소 추출 헬퍼 (공개 엔드포인트용)
 * @param {Request} request
 */
export function getClientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
