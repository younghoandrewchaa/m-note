import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerZIP } from '@electron-forge/maker-zip'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { MakerDeb } from '@electron-forge/maker-deb'
import { MakerRpm } from '@electron-forge/maker-rpm'
import { PublisherGitHub } from '@electron-forge/publisher-github'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { electronFuses } from './scripts/electron-fuses.mjs'
import packageJson from './package.json'

const config: ForgeConfig = {
  packagerConfig: {
    asar: packageJson.macRelease.packager.asar,
    appBundleId: packageJson.macRelease.packager.appBundleId,
    icon: packageJson.macRelease.packager.icon,
    extendInfo: packageJson.macRelease.packager.extendInfo,
    osxSign: {
      ignore: (file: string) => /\/[^/]+\.lproj\/locale\.pak$/.test(file),
    },
    osxNotarize: process.env.APPLE_ID
      ? {
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_ID_PASSWORD!,
          teamId: process.env.APPLE_TEAM_ID!,
        }
      : {
          keychainProfile: process.env.APPLE_KEYCHAIN_PROFILE || 'm-note',
        },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP(
      {
        macUpdateManifestBaseUrl:
          'https://github.com/younghoandrewchaa/m-note/releases/latest/download',
      },
      ['darwin'],
    ),
    new MakerDMG({ format: 'ULFO' }),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  publishers: [
    new PublisherGitHub({
      repository: { owner: 'younghoandrewchaa', name: 'm-note' },
      prerelease: false,
      draft: false,
    }),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin(electronFuses),
  ],
}

export default config
