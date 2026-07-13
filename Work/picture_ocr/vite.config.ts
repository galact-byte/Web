import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        // DOCX 仅由 Word 导出动态加载；单独分块可避免其依赖重新并入首屏代码。
        manualChunks: {
          docx: ['docx'],
        },
      },
    },
  },
})
