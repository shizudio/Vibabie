import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        photography: resolve(__dirname, 'photography.html'),
        cosmos: resolve(__dirname, 'cosmos.html'),
        contact: resolve(__dirname, 'contact.html'),
        instagram: resolve(__dirname, 'instagram.html'),
        art: resolve(__dirname, 'art.html'),
        record: resolve(__dirname, 'record.html'),
      },
    },
  },
})
