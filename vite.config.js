import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from "@cloudflare/vite-plugin";
// Replace 'pdeu-me-portal' with your actual GitHub repo name
export default defineConfig({ plugins: [react(), cloudflare()], base: '/pdeu-me-portal/' })