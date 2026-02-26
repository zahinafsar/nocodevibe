/**
 * Fetches models.json from GitHub at runtime.
 * Caches in memory — refreshes every 5 minutes.
 * Falls back to last cached value on fetch failure.
 */

const RAW_URL =
  "https://raw.githubusercontent.com/zahinafsar/coodeen/main/models.json";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface FreeModelEntry {
  id: string;
  name: string;
}

export interface ModelsConfig {
  providers: Record<string, { label: string; models: string[] }>;
  free: {
    provider: string;
    label: string;
    baseURL: string;
    models: FreeModelEntry[];
  };
}

let cached: ModelsConfig | null = null;
let cachedAt = 0;

/** Fetch and return the models config. Caches for 5 min. */
export async function getModelsConfig(): Promise<ModelsConfig> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const res = await fetch(RAW_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) throw new Error(`GitHub returned ${res.status}`);

    const data = (await res.json()) as ModelsConfig;
    cached = data;
    cachedAt = Date.now();
    return data;
  } catch {
    // Return stale cache if available
    if (cached) return cached;
    // Hard fallback — should never happen in practice
    throw new Error("Failed to fetch models config and no cache available");
  }
}
