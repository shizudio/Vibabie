import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import peUploadPlugin from './vite-plugin-pe-upload.js'

export default defineConfig({
  plugins: [react(), peUploadPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        v2: resolve(__dirname, 'v2.html'),
        about: resolve(__dirname, 'about.html'),
        photography: resolve(__dirname, 'photography.html'),
        cosmos: resolve(__dirname, 'cosmos.html'),
        contact: resolve(__dirname, 'contact.html'),
        instagram: resolve(__dirname, 'instagram.html'),
        art: resolve(__dirname, 'art.html'),
        flowers: resolve(__dirname, 'flowers.html'),
        record: resolve(__dirname, 'record.html'),
        work: resolve(__dirname, 'work.html'),
        ai: resolve(__dirname, 'ai.html'),
        perena: resolve(__dirname, 'perena.html'),
        perenaV2: resolve(__dirname, 'perena-v2.html'),
        stoneflower: resolve(__dirname, 'stoneflower.html'),
        birthday: resolve(__dirname, 'birthday.html'),
        toolPortfolioEditor: resolve(__dirname, 'tool-portfolio-editor.html'),
        toolHotspotEditor: resolve(__dirname, 'tool-hotspot-editor.html'),
        brandedInSec: resolve(__dirname, 'branded-in-sec.html'),
        solmiLanding: resolve(__dirname, 'solmi-landing.html'),
      },
    },
  },
})
