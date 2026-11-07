import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import pkg from "./package.json"

// Every dependency (and its subpaths) stays external; consumers install them.
const externals = [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies),
].map((name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(/|$)`))

export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: { api: "modern-compiler" },
    },
  },
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    sourcemap: true,
    rollupOptions: {
      external: (id) => externals.some((re) => re.test(id)),
      output: { banner: '"use client";' },
    },
  },
})
