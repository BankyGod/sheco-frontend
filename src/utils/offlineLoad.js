/**
 * Try the live API; on failure return cached data when available.
 * Returns { data, fromCache, savedAt, error }
 */
export async function loadOnlineOrCache({ fetcher, readCache, writeCache }) {
  try {
    const data = await fetcher()
    if (writeCache) {
      try {
        await writeCache(data)
      } catch {
        /* cache write is best-effort */
      }
    }
    return { data, fromCache: false, savedAt: '', error: '' }
  } catch (err) {
    const cached = readCache ? await readCache() : null
    if (cached != null) {
      return {
        data: cached.data,
        fromCache: true,
        savedAt: cached.savedAt || '',
        error: '',
      }
    }
    return {
      data: null,
      fromCache: false,
      savedAt: '',
      error: err.message || 'Unable to load data',
    }
  }
}
