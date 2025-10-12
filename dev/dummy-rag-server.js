// Simple dummy RAG SDK server implementing pipeline endpoints
// Run: node dev/dummy-rag-server.js

const http = require('http')
const url = require('url')

const PORT = 40004

// In-memory pipelines: { name: { config: {}, files: Set<string> } }
const PIPELINES = Object.create(null)

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
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

function fileItem(path) {
  const name = String(path).split('/').pop() || String(path)
  return { authors: [], file_name: name, file_path: String(path), title: '' }
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true)
  const pathname = parsed.pathname

  if (req.method === 'OPTIONS') {
    return handleOptions(req, res)
  }

  if (req.method === 'POST' && pathname === '/create_pipeline') {
    try {
      const raw = await readRequestBody(req)
      let payload = {}
      try { payload = JSON.parse(raw || '{}') } catch {}
      const name = String(payload.pipeline_name || '').trim()
      const config = typeof payload.config === 'object' && payload.config ? payload.config : {}
      if (!name) return sendJSON(res, 400, { status: 'error', message: 'pipeline_name is required' })
      PIPELINES[name] = PIPELINES[name] || { config: {}, files: new Set() }
      PIPELINES[name].config = config
      // Simulate delay
      const delayMs = 2000
      setTimeout(() => {
        sendJSON(res, 200, { status: 'success', message: 'Pipeline created successfully', pipeline_name: name, processing_time_ms: delayMs })
      }, delayMs)
    }
    catch (e) {
      sendJSON(res, 500, { status: 'error', message: e?.message || 'Internal error' })
    }
    return
  }

  if (req.method === 'POST' && pathname === '/index') {
    try {
      const raw = await readRequestBody(req)
      let payload = {}
      try { payload = JSON.parse(raw || '{}') } catch {}
      const pipelineName = String(payload.pipeline_name || '').trim()
      const filePath = payload.file_path || payload.path
      if (!pipelineName) return sendJSON(res, 400, { status: 'error', message: 'pipeline_name is required' })
      if (!filePath) return sendJSON(res, 400, { status: 'error', message: 'file_path is required' })
      PIPELINES[pipelineName] = PIPELINES[pipelineName] || { config: {}, files: new Set() }
      const delayMs = 567
      setTimeout(() => {
        PIPELINES[pipelineName].files.add(String(filePath))
        sendJSON(res, 200, {
          pipeline_name: pipelineName,
          file_path: String(filePath),
          message: 'File indexed successfully',
          processing_time_ms: 567,
          status: 'success',
        })
      }, delayMs)
    }
    catch (e) {
      sendJSON(res, 500, { status: 'error', message: e?.message || 'Internal error' })
    }
    return
  }

  if (req.method === 'POST' && pathname === '/remove_file') {
    try {
      const raw = await readRequestBody(req)
      let payload = {}
      try { payload = JSON.parse(raw || '{}') } catch {}
      const pipelineName = String(payload.pipeline_name || '').trim()
      const filePath = payload.file_path || payload.name
      if (!pipelineName) return sendJSON(res, 400, { status: 'error', message: 'pipeline_name is required' })
      if (!filePath) return sendJSON(res, 400, { status: 'error', message: 'file_path is required' })
      if (!PIPELINES[pipelineName]) return sendJSON(res, 404, { status: 'error', message: `pipeline ${pipelineName} not found` })
      PIPELINES[pipelineName].files.delete(String(filePath))
      sendJSON(res, 200, { pipeline_name: pipelineName, removed: String(filePath), message: 'File removed successfully', processing_time_ms: 3, status: 'success' })
    }
    catch (e) {
      sendJSON(res, 500, { status: 'error', message: e?.message || 'Internal error' })
    }
    return
  }

  if (req.method === 'POST' && pathname === '/remove_pipeline') {
    try {
      const raw = await readRequestBody(req)
      let payload = {}
      try { payload = JSON.parse(raw || '{}') } catch {}
      const pipelineName = String(payload.pipeline_name || '').trim()
      if (!pipelineName) return sendJSON(res, 400, { status: 'error', message: 'pipeline_name is required' })
      if (!PIPELINES[pipelineName]) return sendJSON(res, 404, { status: 'error', message: `pipeline ${pipelineName} not found` })
      delete PIPELINES[pipelineName]
      sendJSON(res, 200, { status: 'success', pipeline_name: pipelineName, message: 'Pipeline removed' })
    }
    catch (e) {
      sendJSON(res, 500, { status: 'error', message: e?.message || 'Internal error' })
    }
    return
  }

  if (req.method === 'GET' && pathname === '/list_files') {
    const pipelineName = String((parsed.query?.pipeline_name || '')).trim()
    if (!pipelineName) return sendJSON(res, 400, { status: 'error', message: 'pipeline_name is required' })
    const entry = PIPELINES[pipelineName]
    const files = entry ? Array.from(entry.files).sort() : []
    const fileItems = files.map(fileItem)
    return sendJSON(res, 200, {
      status: 'success',
      pipeline_name: pipelineName,
      file_count: fileItems.length,
      files: fileItems,
    })
  }

  if (req.method === 'GET' && pathname === '/list_pipelines') {
    const pipelines = Object.keys(PIPELINES).map((name) => ({
      name,
      config: PIPELINES[name].config || {},
      n_gpu: 4,
      path: `rag_data/pipelines/${name}`,
    }))
    return sendJSON(res, 200, { status: 'success', pipeline_count: pipelines.length, pipelines })
  }

  // Legacy non-pipeline remove for compatibility
  if (req.method === 'POST' && pathname === '/remove') {
    try {
      const raw = await readRequestBody(req)
      let payload = {}
      try { payload = JSON.parse(raw || '{}') } catch {}
      const id = payload.file_name || payload.file_path || payload.name || 'unknown'
      return sendJSON(res, 200, { removed: String(id), message: 'File removed successfully', status: 'success' })
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