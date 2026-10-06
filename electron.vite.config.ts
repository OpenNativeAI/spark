import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    server: {
      // 固定开发端口：Electron 的 localStorage 按 origin(含端口) 隔离，
      // 端口漂移会导致书签等本地数据“看起来丢失”。
      // 使用 strictPort 避免因自动切换端口而换分区。
      port: 5175,
      strictPort: true
    }
  }
})
