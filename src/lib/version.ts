declare const __APP_VERSION__: string

export const APP_VERSION = __APP_VERSION__

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export async function checkVersion(): Promise<{
  updateAvailable: boolean
  forceRefresh: boolean
}> {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' })
    if (!res.ok) return { updateAvailable: false, forceRefresh: false }
    const data = await res.json()
    return {
      updateAvailable: compareVersions(data.version, APP_VERSION) > 0,
      forceRefresh: compareVersions(APP_VERSION, data.minimumSupportedVersion) < 0,
    }
  } catch {
    return { updateAvailable: false, forceRefresh: false }
  }
}
