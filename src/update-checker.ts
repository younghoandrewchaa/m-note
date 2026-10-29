import { app, net } from 'electron'
const RELEASES = 'https://github.com/younghoandrewchaa/m-note/releases'
export interface UpdateInfo {
  version: string
  feedUrl: string
}
function versionParts(version: string): number[] {
  if (!/^\d+\.\d+\.\d+$/.test(version))
    throw new Error('Invalid update version.')
  return version.split('.').map(Number)
}
// Read the feed via the latest-release download redirect rather than the
// GitHub REST API, whose unauthenticated limit (60/hour per IP) is easily
// exhausted on shared networks and surfaces as a 403.
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (process.platform !== 'darwin')
    throw new Error(
      'A compatible update is not available yet. Please retry later.',
    )
  const feedName = `update-darwin-${process.arch}.json`
  const response = await net.fetch(`${RELEASES}/latest/download/${feedName}`)
  if (response.status === 404)
    throw new Error(
      'A compatible update is not available yet. Please retry later.',
    )
  if (!response.ok)
    throw new Error(
      `Unable to check for updates (${response.status}). Please retry.`,
    )
  const metadata = (await response.json()) as {
    url?: string
    name?: string
    notes?: string
    pub_date?: string
  }
  const match =
    typeof metadata.url === 'string'
      ? metadata.url.match(
          /^https:\/\/github\.com\/younghoandrewchaa\/m-note\/releases\/download\/v(\d+\.\d+\.\d+)\/[^/]+-darwin-([a-z0-9]+)-(\d+\.\d+\.\d+)\.zip$/,
        )
      : null
  const version = match?.[1]
  if (
    !match ||
    match[2] !== process.arch ||
    match[3] !== version ||
    typeof metadata.name !== 'string' ||
    !metadata.name.includes(version) ||
    typeof metadata.notes !== 'string' ||
    !Number.isFinite(Date.parse(metadata.pub_date ?? ''))
  ) {
    throw new Error('Invalid update metadata. Please retry later.')
  }
  const latest = versionParts(version),
    current = versionParts(app.getVersion())
  const difference =
    latest.map((n, i) => n - current[i]).find((n) => n !== 0) ?? 0
  if (difference <= 0) return null
  // Pin Squirrel to this release so a newer publish can't swap the feed mid-update.
  return { version, feedUrl: `${RELEASES}/download/v${version}/${feedName}` }
}
