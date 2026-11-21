import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { flipFuses } from '@electron/fuses'
import { loadConfig } from 'electron-mac-release/lib/config.mjs'
import { packageApp } from 'electron-mac-release/lib/package.mjs'
import { electronFuses } from './electron-fuses.mjs'

const config = loadConfig()
const sign = process.argv.includes('--sign')
const appPath = await packageApp({
  ...config,
  arch: process.arch,
  packager: {
    ...config.packager,
    afterCopy: [({ buildPath }) =>
      flipFuses(resolve(buildPath, '../../MacOS/Electron'), electronFuses),
    ],
  },
}, { sign })

// Packager updates Info.plist and the ASAR digest after the fuses are set.
if (!sign)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })

console.log(appPath)
