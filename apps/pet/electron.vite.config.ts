import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    // @nosy/core는 workspace 심볼릭 링크다. 외부 의존성으로 두면 패키징된 asar 안에
    // node_modules/@nosy/core가 없어 런타임에 깨진다. 런타임 의존성이 없는 순수
    // TypeScript 패키지라 번들에 인라인하는 편이 안전하다.
    plugins: [externalizeDepsPlugin({ exclude: ['@nosy/core'] })],
    build: {
      outDir: 'out/main',
      lib: { entry: resolve(__dirname, 'main/index.ts') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@nosy/core'] })],
    build: {
      outDir: 'out/preload',
      lib: { entry: resolve(__dirname, 'main/preload.ts') }
    }
  },
  renderer: {
    root: resolve(__dirname, 'renderer'),
    plugins: [react()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: resolve(__dirname, 'renderer/index.html') }
    }
  }
})
