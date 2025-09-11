const SERVER_URL_KEY = 'rag_sdk_server_url'
const DEFAULT_SERVER_URL = 'http://localhost:40004'
// Optional client-side config to shape file_path for legacy RAG servers
// If both are set, we compute a relative path from server CWD to (doc base + fileName)
// localStorage keys (set in browser console):
//   rag_sdk_server_cwd -> e.g. '/Users/yexiaoyu/Projects/dify/dev'
//   rag_sdk_doc_base   -> e.g. '/Users/yexiaoyu/Downloads'
// If not set, but rag_sdk_path_prefix exists, we prepend that to the filename
//   rag_sdk_path_prefix -> e.g. '../../../Downloads/'

// Small POSIX-like path helpers for the browser (no Node path dependency)
function normSegments(parts: string[], allowAboveRoot = false) {
  const res: string[] = []
  for (const p of parts) {
    if (!p || p === '.') continue
    if (p === '..') {
      if (res.length && res[res.length - 1] !== '..') res.pop()
      else if (allowAboveRoot) res.push('..')
    }
    else { res.push(p) }
  }
  return res
}

function posixNormalize(path: string): string {
  if (!path) return ''
  const isAbs = path.startsWith('/')
  const parts = normSegments(path.split('/'), !isAbs)
  const joined = parts.join('/')
  return (isAbs ? '/' : '') + joined || (isAbs ? '/' : '.')
}

function posixJoin(...paths: string[]): string {
  return posixNormalize(paths.filter(Boolean).join('/'))
}

function posixRelative(from: string, to: string): string {
  if (!from || !to) return to
  const fromNorm = posixNormalize(from)
  const toNorm = posixNormalize(to)
  const fromAbs = fromNorm.startsWith('/')
  const toAbs = toNorm.startsWith('/')
  if (!fromAbs || !toAbs) return to // need absolutes to compute reliably
  const fromParts = fromNorm.split('/').filter(Boolean)
  const toParts = toNorm.split('/').filter(Boolean)
  let i = 0
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) i++
  const up = new Array(fromParts.length - i).fill('..')
  const down = toParts.slice(i)
  const rel = [...up, ...down].join('/')
  return rel || '.'
}

/**
 * RAG SDK API Service
 * This service integrates with the custom RAG SDK API
 */
class RagSdkApiService {
  private serverUrl: string

  constructor() {
    this.serverUrl = this.getServerUrl() || DEFAULT_SERVER_URL
  }

  private getServerCwd(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('rag_sdk_server_cwd')
  }

  private getDocBase(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('rag_sdk_doc_base')
  }

  private getPathPrefix(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('rag_sdk_path_prefix')
  }

  // Compute the outgoing file_path based on optional client config
  private transformFilePath(fileName: string): string {
    const cwd = this.getServerCwd()
    const base = this.getDocBase()
    if (cwd && base) {
      // absolute target path = join(base, fileName)
      const absTarget = posixJoin(base, fileName)
      const rel = posixRelative(cwd, absTarget)
      return rel
    }
    const prefix = this.getPathPrefix()
    if (prefix) return `${prefix.replace(/\\+/g, '/')}${fileName}`
    // default: just send the file name
    return fileName
  }

  // Index a file into vector DB via RAG SDK
  async indexFile(fileName: string): Promise<any> {
    const res = await fetch(`${this.serverUrl}/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: this.transformFilePath(fileName) }),
    })

    if (!res.ok)
      throw new Error(`Index failed with status ${res.status}`)

    try {
      return await res.json()
    }
    catch {
      return { success: true }
    }
  }

  // New: Remove a file from vector DB via RAG SDK
  async removeFile(fileName: string): Promise<any> {
    const res = await fetch(`${this.serverUrl}/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: this.transformFilePath(fileName) }),
    })

    if (!res.ok)
      throw new Error(`Remove failed with status ${res.status}`)

    try {
      return await res.json()
    }
    catch {
      return { success: true }
    }
  }

  /**
   * Get the server URL
   * @returns The server URL
   */
  getServerUrl(): string {
    if (typeof window !== 'undefined')
      return localStorage.getItem(SERVER_URL_KEY) || DEFAULT_SERVER_URL

    return DEFAULT_SERVER_URL
  }

  /**
   * Set the server URL
   * @param url The new server URL
   */
  setServerUrl(url: string): void {
    this.serverUrl = url
    if (typeof window !== 'undefined')
      localStorage.setItem(SERVER_URL_KEY, url)
  }

  // New: Index by raw file_path (no transform), similar to Python aindex_file(file_path)
  async indexFilePath(file_path: string): Promise<any> {
    const res = await fetch(`${this.serverUrl}/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path }),
    })

    if (!res.ok)
      throw new Error(`Index failed with status ${res.status}`)

    try {
      return await res.json()
    }
    catch {
      return { success: true }
    }
  }

  // Optional alias to mirror Python naming
  async aindexFile(file_path: string): Promise<any> {
    return this.indexFilePath(file_path)
  }

  // New: Remove by raw file_path (no transform)
  async removeFilePath(file_path: string): Promise<any> {
    const res = await fetch(`${this.serverUrl}/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path }),
    })

    if (!res.ok)
      throw new Error(`Remove failed with status ${res.status}`)

    try {
      return await res.json()
    }
    catch {
      return { success: true }
    }
  }

  // New: Concurrency-limited batch index for file names
  async indexFiles(
    fileNames: string[],
    opts: { concurrency?: number } = {},
  ): Promise<{ results: { file: string; ok: boolean; data?: any; error?: string }[] }> {
    const concurrency = Math.max(1, opts.concurrency ?? 4)
    const results: { file: string; ok: boolean; data?: any; error?: string }[] = new Array(fileNames.length)
    let i = 0

    const worker = async () => {
      while (true) {
        const idx = i++
        if (idx >= fileNames.length) break
        const f = fileNames[idx]
        try {
          const data = await this.indexFile(f)
          results[idx] = { file: f, ok: true, data }
        }
        catch (e: any) {
          results[idx] = { file: f, ok: false, error: e?.message || String(e) }
        }
      }
    }

    const workers = new Array(Math.min(concurrency, fileNames.length)).fill(0).map(() => worker())
    await Promise.all(workers)
    return { results }
  }
}

// Create a singleton instance
export const ragSdkApiService = new RagSdkApiService()
