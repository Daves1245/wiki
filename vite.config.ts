import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { wikiPlugin } from './vite-plugin-wiki'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wikiPlugin()],
})
