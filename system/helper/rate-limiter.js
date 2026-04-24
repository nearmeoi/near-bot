const buckets = new Map()

const DEFAULT_MAX_TOKENS = 10
const DEFAULT_REFILL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

function getBucket(jid, maxTokens) {
  const now = Date.now()
  let bucket = buckets.get(jid)
  if (!bucket) {
    bucket = { tokens: maxTokens, lastRefill: now }
    buckets.set(jid, bucket)
    return bucket
  }
  const elapsed = now - bucket.lastRefill
  if (elapsed >= DEFAULT_REFILL_INTERVAL_MS) {
    const refills = Math.floor(elapsed / DEFAULT_REFILL_INTERVAL_MS)
    bucket.tokens = Math.min(maxTokens, bucket.tokens + refills * maxTokens)
    bucket.lastRefill = now
  }
  return bucket
}

export function consumeRate(jid, cost = 1, maxTokens = DEFAULT_MAX_TOKENS) {
  const bucket = getBucket(jid, maxTokens)
  if (bucket.tokens >= cost) {
    bucket.tokens -= cost
    return true
  }
  return false
}

function cleanupStaleBuckets() {
  const cutoff = Date.now() - DEFAULT_REFILL_INTERVAL_MS * 2
  for (const [jid, bucket] of buckets) {
    if (bucket.lastRefill < cutoff) {
      buckets.delete(jid)
    }
  }
}

setInterval(cleanupStaleBuckets, 10 * 60 * 1000)
