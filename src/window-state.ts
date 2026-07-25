import fs from 'node:fs'
import path from 'node:path'

export type WindowBounds = {
  x: number
  y: number
  width: number
  height: number
}

const STATE_FILE_NAME = 'window-state.json'
const MIN_WIDTH = 320
const MIN_HEIGHT = 240

function getStateFilePath(userDataPath: string) {
  return path.join(userDataPath, STATE_FILE_NAME)
}

export function getDefaultWindowBounds(
  primaryWorkAreaSize: { width: number; height: number }
): WindowBounds {
  const { width, height } = primaryWorkAreaSize
  return {
    x: 0,
    y: 0,
    width: Math.round(primaryWorkAreaSize.width / 2),
    height: primaryWorkAreaSize.height,
  }
}

function isFiniteBounds(value: unknown): value is WindowBounds {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WindowBounds>;
  return (
    Number.isFinite(candidate.x) &&
    Number.isFinite(candidate.y) &&
    Number.isFinite(candidate.width) &&
    Number.isFinite(candidate.height)
  );
}

function intersects(a: WindowBounds, b: WindowBounds) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

export function isValidWindowBounds(
  bounds: unknown,
  workAreas: WindowBounds[]
): bounds is WindowBounds {
  if (!isFiniteBounds(bounds)) return false;
  if (bounds.width < MIN_WIDTH || bounds.height < MIN_HEIGHT) return false;

  return workAreas.some((workArea) => intersects(bounds, workArea));
}

export function readWindowBounds(
  userDataPath: string,
  workAreas: WindowBounds[]
): WindowBounds | null {
  const filePath = getStateFilePath(userDataPath)
  if (!fs.existsSync(filePath)) return null

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    return isValidWindowBounds(parsed, workAreas) ? parsed : null
  }
  catch {
    return null
  }
}

export function writeWindowBounds(userDataPath: string, bounds: WindowBounds) {
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(getStateFilePath(userDataPath), JSON.stringify(bounds, null, 2), 'utf-8');
}

export function createDebouncedWindowBoundsWriter(userDataPath: string, delayMs = 250) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let latestBounds: WindowBounds | null = null;

  return (bounds: WindowBounds) => {
    latestBounds = bounds;
    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      if (latestBounds) writeWindowBounds(userDataPath, latestBounds);
      timeout = null;
    }, delayMs);
  };
}