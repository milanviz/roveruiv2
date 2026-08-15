import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"

const vizruProxy = {
  target: "https://ai-demo.vizru-ras.com",
  changeOrigin: true,
  secure: true,
  rewrite: (requestPath: string) => requestPath.replace(/^\/vizru-api/, ""),
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
  // Vizru's workflow responses omit Access-Control-Allow-Origin. Keep browser
  // requests same-origin during local development and forward them server-side.
  server: {
    proxy: { "/vizru-api": vizruProxy },
  },
  preview: {
    proxy: { "/vizru-api": vizruProxy },
  },
})
