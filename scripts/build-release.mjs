import { builtinModules } from 'node:module'
import { build } from 'vite'

const external = [
  'electron',
  'electron/main',
  'electron/renderer',
  ...builtinModules,
  /^node:/,
]

for (const entry of ['main', 'preload']) {
  await build({
    configFile: `vite.${entry}.config.ts`,
    define: {
      MAIN_WINDOW_VITE_DEV_SERVER_URL: 'undefined',
      MAIN_WINDOW_VITE_NAME: JSON.stringify('main_window'),
    },
    build: {
      copyPublicDir: false,
      emptyOutDir: entry === 'main',
      outDir: '.vite/build',
      lib: {
        entry: `src/${entry}.ts`,
        formats: ['cjs'],
        fileName: () => `${entry}.cjs`,
      },
      rollupOptions: { external },
    },
  })
}

await build({
  configFile: 'vite.renderer.config.ts',
  base: './',
  build: { outDir: '.vite/renderer/main_window' },
})
