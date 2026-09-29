import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// Writes dist/sw.js: the service worker that keeps the app opening with no connection. It lists
// every file in the build, so what is cached is exactly what this version needs.
function appShell(): Plugin {
  let outDir = 'dist'

  return {
    name: 'app-shell',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const files: string[] = []
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name)
          if (statSync(full).isDirectory()) walk(full)
          else files.push(full)
        }
      }
      walk(outDir)

      const urls = files
        .map((f) => '/' + relative(outDir, f).split('\\').join('/'))
        .filter((u) => !u.endsWith('.map') && u !== '/sw.js')
        .sort()

      // Any change to any file gives a new version, so the old cache is replaced as a whole.
      const hash = createHash('sha256')
      for (const url of urls) hash.update(url).update(readFileSync(join(outDir, url)))

      const source = readFileSync(fileURLToPath(new URL('./scripts/sw-template.js', import.meta.url)), 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', JSON.stringify(['/', ...urls], null, 2))

      writeFileSync(join(outDir, 'sw.js'), source)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    appShell(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
