import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { Connect } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

// Dev-mode switch list stored alongside the project (gitignored)
const DEV_DATA = path.resolve('.dev-data')
const SWITCHES_FILE = path.join(DEV_DATA, 'switches.json')

function readSwitches() {
  try { return JSON.parse(fs.readFileSync(SWITCHES_FILE, 'utf8')) } catch { return [] }
}
function writeSwitches(list: unknown[]) {
  if (!fs.existsSync(DEV_DATA)) fs.mkdirSync(DEV_DATA, { recursive: true })
  fs.writeFileSync(SWITCHES_FILE, JSON.stringify(list, null, 2))
}
function jsonRes(res: ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(data)
}
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let buf = ''
    req.on('data', (c: Buffer) => buf += c)
    req.on('end', () => resolve(buf))
  })
}

function switchesApi(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = req.url ?? '/'

    if (url === '/api/switches' && req.method === 'GET')
      return jsonRes(res, 200, readSwitches())

    if (url === '/api/switches' && req.method === 'POST') {
      const { name, ip } = JSON.parse(await readBody(req))
      const sw = { id: crypto.randomUUID(), name, ip }
      writeSwitches([...readSwitches(), sw])
      return jsonRes(res, 201, sw)
    }

    const del = url.match(/^\/api\/switches\/([^/]+)$/)
    if (del && req.method === 'DELETE') {
      writeSwitches(readSwitches().filter((s: { id: string }) => s.id !== del[1]))
      res.writeHead(204); res.end(); return
    }

    next()
  }
}

function switchProxy(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const match = req.url?.match(/^\/switch\/([^/]+)(\/.*)?$/)
    if (!match) return next()
    const [, ip, rest = '/'] = match

    const proxyReq = http.request(
      { hostname: ip, port: 80, path: rest, method: req.method,
        headers: { ...req.headers, host: ip } },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers)
        proxyRes.pipe(res, { end: true })
      }
    )
    proxyReq.on('error', () => { res.writeHead(502); res.end('Switch unreachable') })
    req.pipe(proxyReq, { end: true })
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'dev-api',
      configureServer(server) {
        server.middlewares.use(switchesApi())
        server.middlewares.use(switchProxy())
      },
    },
  ],
})
