// Simple dummy RAG SDK server with /index and /remove endpoints
// Run: node dev/dummy-rag-server.js

const http = require('http')
const url = require('url')

const PORT = 40004

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
}

function sendJSON(res, statusCode, data) {
  setCors(res)
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function handleOptions(req, res) {
  setCors(res)
  res.writeHead(204)
  res.end()
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      resolve(raw)
    })
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url, true)

  if (req.method === 'OPTIONS') {
    return handleOptions(req, res)
  }

  if (req.method === 'POST' && pathname === '/index') {
    try {
      const raw = await readRequestBody(req)
      let payload = {}
      try { payload = JSON.parse(raw || '{}') } catch (e) {}
      const filePath = payload.file_path || payload.path || 'unknown'
      const response = {
        file_path: filePath,
        message: 'File indexed successfully',
        processing_time_ms: Math.floor(Math.random() * 500) + 300,
        status: 'success',
      }
      return sendJSON(res, 200, response)
    } catch (e) {
      return sendJSON(res, 500, { status: 'error', message: e?.message || 'Internal error' })
    }
  }

  if (req.method === 'POST' && pathname === '/remove') {
    try {
      const raw = await readRequestBody(req)
      let payload = {}
      try { payload = JSON.parse(raw || '{}') } catch (e) {}
      const id = payload.file_name || payload.file_path || payload.name || 'unknown'
      const response = {
        removed: id,
        message: 'File removed successfully',
        processing_time_ms: Math.floor(Math.random() * 300) + 120,
        status: 'success',
      }
      return sendJSON(res, 200, response)
    } catch (e) {
      return sendJSON(res, 500, { status: 'error', message: e?.message || 'Internal error' })
    }
  }

  // 404 for other routes
  setCors(res)
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ status: 'not_found', message: `No route for ${req.method} ${pathname}` }))
})

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Dummy RAG SDK server listening on http://localhost:${PORT}`)
})