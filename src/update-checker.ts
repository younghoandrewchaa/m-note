import { app , net } from 'electron'

const REPO = 'younghoandrewchaa/m-note'

export interface UpdateInfo {
  version: string
  downloadUrl: string
}

function isNewer(latest: string, current: string): boolean {
  const a = latest.split('.').map(Number)
  const b = current.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    if (av > bv) return true
    if (av < bv) return false
  }
  return false
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const response = await net.fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      { headers: { Accept: 'application/vnd.github.v3+json' } },
    )
    if (!response.ok) return null

    const release = await response.json() as {
      tag_name: string
      assets: Array<{ name: string; browser_download_url: string }>
    }

    const latestVersion = release.tag_name.replace(/^v/, '')
    const currentVersion = app.getVersion()

    if (!isNewer(latestVersion, currentVersion)) return null

    const platform = process.platform
    const asset = release.assets.find((a) => {
      if (platform === 'darwin') return a.name.endsWith('.dmg')
      if (platform === 'win32') return a.name.endsWith('.exe') && a.name.includes('Setup')
      return false
    })
    if (!asset) return null

    return {
      version: latestVersion,
      downloadUrl: asset.browser_download_url,
    }
  } catch {
    return null
  }
}
