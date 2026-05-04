/**
 * vite-plugin-pe-upload.js
 * Dev-only middleware: POST /pe-upload saves media files to public/work/
 * Client sends raw binary with Content-Type + X-Filename headers.
 * Returns { path: '/work/filename.ext', name: 'filename.ext' }
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default function peUploadPlugin() {
  return {
    name: 'pe-upload',
    apply: 'serve',   // dev only — excluded from production build
    configureServer(server) {
      const IMG_DIR = path.resolve(__dirname, 'public/work')
      const VID_DIR = path.resolve(__dirname, 'public/work/Videos')

      fs.mkdirSync(IMG_DIR, { recursive: true })
      fs.mkdirSync(VID_DIR, { recursive: true })

      server.middlewares.use('/pe-upload', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        const mimeType = req.headers['content-type'] || ''
        const rawName  = req.headers['x-filename']   || 'upload'
        const filename = decodeURIComponent(rawName)
        const isVideo  = mimeType.startsWith('video/')

        // Sanitise filename and make it unique
        const ext      = path.extname(filename).toLowerCase()
        const base     = path.basename(filename, ext)
          .replace(/[^a-z0-9-_]/gi, '-')
          .toLowerCase()
          .slice(0, 60)
        const saveName = `${base}-${Date.now()}${ext}`
        const savePath = path.join(isVideo ? VID_DIR : IMG_DIR, saveName)
        const publicPath = isVideo ? `/work/Videos/${saveName}` : `/work/${saveName}`

        const chunks = []
        req.on('data', chunk => chunks.push(chunk))
        req.on('end', () => {
          fs.writeFile(savePath, Buffer.concat(chunks), err => {
            res.setHeader('Content-Type', 'application/json')
            if (err) {
              console.error('[pe-upload] write error:', err)
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message }))
              return
            }
            console.log(`[pe-upload] saved → ${savePath}`)
            res.end(JSON.stringify({ path: publicPath, name: saveName }))
          })
        })
        req.on('error', err => {
          res.statusCode = 500
          res.end(JSON.stringify({ error: err.message }))
        })
      })
    },
  }
}
