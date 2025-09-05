const SERVER_URL_KEY = 'rag_sdk_server_url'
const DEFAULT_SERVER_URL = 'http://localhost:40004'

/**
 * RAG SDK API Service
 * This service integrates with the custom RAG SDK API
 */
class RagSdkApiService {
  private serverUrl: string

  constructor() {
    this.serverUrl = this.getServerUrl() || DEFAULT_SERVER_URL
  }

  // Index a file into vector DB via RAG SDK
  async indexFile(file: File, onProgress?: (progress: number) => void): Promise<any> {
    return new Promise((resolve, reject) => {
      const formData = new FormData()
      formData.append('file', file)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${this.serverUrl}/index`, true)

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            onProgress(progress)
          }
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            resolve(response)
          } catch (error) {
            resolve({ success: true })
          }
        } else {
          reject(new Error(`Index failed with status ${xhr.status}`))
        }
      }

      xhr.onerror = () => {
        reject(new Error('Network error occurred during index'))
      }

      xhr.send(formData)
    })
  }

  // New: Remove a file from vector DB via RAG SDK
  async removeFile(fileName: string): Promise<any> {
    const res = await fetch(`${this.serverUrl}/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_name: fileName }),
    })

    if (!res.ok) {
      throw new Error(`Remove failed with status ${res.status}`)
    }

    try {
      return await res.json()
    } catch {
      return { success: true }
    }
  }

  /**
   * Get the server URL
   * @returns The server URL
   */
  getServerUrl(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SERVER_URL_KEY) || DEFAULT_SERVER_URL
    }
    return DEFAULT_SERVER_URL
  }

  /**
   * Set the server URL
   * @param url The new server URL
   */
  setServerUrl(url: string): void {
    this.serverUrl = url
    if (typeof window !== 'undefined') {
      localStorage.setItem(SERVER_URL_KEY, url)
    }
  }
}

// Create a singleton instance
export const ragSdkApiService = new RagSdkApiService()