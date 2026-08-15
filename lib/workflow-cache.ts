type CacheEnvelope<T> = {
  value: T
  expiresAt: number
}

const CACHE_PREFIX = "rover_workflow_cache_v3:"
const memoryCache = new Map<string, CacheEnvelope<unknown>>()
const inFlight = new Map<string, Promise<unknown>>()

function storageKey(key: string) {
  return `${CACHE_PREFIX}${key}`
}

function readEnvelope<T>(key: string): CacheEnvelope<T> | null {
  const memory = memoryCache.get(key) as CacheEnvelope<T> | undefined
  if (memory) return memory
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(storageKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope<T>
    if (!parsed || typeof parsed.expiresAt !== "number") return null
    memoryCache.set(key, parsed)
    return parsed
  } catch {
    return null
  }
}

export function readWorkflowCache<T>(key: string, allowExpired = false): T | null {
  const cached = readEnvelope<T>(key)
  if (!cached || (!allowExpired && cached.expiresAt <= Date.now())) return null
  return cached.value
}

export function writeWorkflowCache<T>(key: string, value: T, ttlMs: number) {
  const envelope: CacheEnvelope<T> = { value, expiresAt: Date.now() + ttlMs }
  memoryCache.set(key, envelope)
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(storageKey(key), JSON.stringify(envelope))
    } catch {
      // Memory caching remains available when storage is full or unavailable.
    }
  }
}

export function invalidateWorkflowCache(key: string) {
  memoryCache.delete(key)
  if (typeof window !== "undefined") localStorage.removeItem(storageKey(key))
}

export async function cachedWorkflowRequest<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  options: { force?: boolean; staleOnError?: boolean } = {},
): Promise<T> {
  if (!options.force) {
    const fresh = readWorkflowCache<T>(key)
    if (fresh !== null) return fresh
  }

  const existing = inFlight.get(key) as Promise<T> | undefined
  if (existing) return existing

  const stale = readWorkflowCache<T>(key, true)
  const request = loader()
    .then((value) => {
      writeWorkflowCache(key, value, ttlMs)
      return value
    })
    .catch((error) => {
      if (options.staleOnError !== false && stale !== null) return stale
      throw error
    })
    .finally(() => inFlight.delete(key))

  inFlight.set(key, request)
  return request
}

export const WORKFLOW_CACHE_TTL = {
  USER: 24 * 60 * 60 * 1000,
  PROJECTS: 5 * 60 * 1000,
  DASHBOARD_LIST: 10 * 60 * 1000,
  DASHBOARD: 30 * 24 * 60 * 60 * 1000,
  FILE_METADATA: 24 * 60 * 60 * 1000,
} as const
