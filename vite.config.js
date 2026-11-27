import { defineConfig } from 'vite'
import { resolve } from 'path'
import peUploadPlugin from './vite-plugin-pe-upload.js'
import fieldNotesPlugin from './vite-plugin-field-notes.js'
import portraitPlugin from './vite-plugin-portrait.js'

export default defineConfig({
  plugins: [peUploadPlugin(), fieldNotesPlugin(), portraitPlugin()],
  server: {
    proxy: {
      '/api/photodump': {
        target: process.env.PHOTODUMP_API_ORIGIN || 'https://shizudio.me',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play.html'),
        about: resolve(__dirname, 'about.html'),
        photography: resolve(__dirname, 'photography.html'),
        photodump: resolve(__dirname, 'photodump.html'),
        cosmos: resolve(__dirname, 'cosmos.html'),
        contact: resolve(__dirname, 'contact.html'),
        instagram: resolve(__dirname, 'instagram.html'),
        art: resolve(__dirname, 'art.html'),
        flowers: resolve(__dirname, 'flowers.html'),
        record: resolve(__dirname, 'record.html'),
        work: resolve(__dirname, 'work.html'),
        ai: resolve(__dirname, 'ai.html'),
        perena: resolve(__dirname, 'perena.html'),
        stoneflower: resolve(__dirname, 'stoneflower.html'),
        coffee: resolve(__dirname, 'coffee.html'),
        solmi: resolve(__dirname, 'solmi.html'),
        sanctum: resolve(__dirname, 'sanctum.html'),
        sancNine: resolve(__dirname, 'sanc-nine.html'),
        birthday: resolve(__dirname, 'birthday.html'),
        toolPortfolioEditor: resolve(__dirname, 'tool-portfolio-editor.html'),
        toolHotspotEditor: resolve(__dirname, 'tool-hotspot-editor.html'),
        brandedInSec: resolve(__dirname, 'branded-in-sec.html'),
        solmiLanding: resolve(__dirname, 'solmi-landing.html'),
        solmiStudio: resolve(__dirname, 'solmi-studio.html'),
        fieldNotes: resolve(__dirname, 'field-notes.html'),
        fieldNote: resolve(__dirname, 'field-note.html'),
      },
    },
  },
})
