import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BASE_PATH lets the same build serve from a sub-path (GitHub Pages: "/planning/")
// or from the root (Cloudflare Pages: "/"). Default is root.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || '/',
})
