'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RiSettings4Line } from '@remixicon/react'
import PageHeader from '@/app/components/header'
import FileUploader from '@/app/components/rag-sdk/file-uploader'
import { ragSdkApiService } from '@/service/rag-sdk-api'

const RagSdkPage: React.FC = () => {
  const { t } = useTranslation()
  const [serverUrl, setServerUrl] = useState<string>(ragSdkApiService.getServerUrl() || 'http://localhost:40005')

  // Developer settings: server cwd, doc base, and optional path prefix
  const [serverCwd, setServerCwd] = useState<string>('')
  const [docBase, setDocBase] = useState<string>('')
  const [pathPrefix, setPathPrefix] = useState<string>('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    setServerCwd(localStorage.getItem('rag_sdk_server_cwd') || '')
    setDocBase(localStorage.getItem('rag_sdk_doc_base') || '')
    setPathPrefix(localStorage.getItem('rag_sdk_path_prefix') || '')
  }, [])

  const handleServerUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setServerUrl(e.target.value)
  }, [])

  const saveServerUrl = useCallback(() => {
    ragSdkApiService.setServerUrl(serverUrl)
  }, [serverUrl])

  const savePathSettings = useCallback(() => {
    if (typeof window === 'undefined') return
    // Persist server_cwd & doc_base if provided
    if (serverCwd) localStorage.setItem('rag_sdk_server_cwd', serverCwd)
    else localStorage.removeItem('rag_sdk_server_cwd')

    if (docBase) localStorage.setItem('rag_sdk_doc_base', docBase)
    else localStorage.removeItem('rag_sdk_doc_base')

    // Persist prefix as a fallback (will be ignored if both cwd & base exist)
    if (pathPrefix) localStorage.setItem('rag_sdk_path_prefix', pathPrefix)
    else localStorage.removeItem('rag_sdk_path_prefix')
  }, [serverCwd, docBase, pathPrefix])

  const clearPathSettings = useCallback(() => {
    if (typeof window === 'undefined') return
    localStorage.removeItem('rag_sdk_server_cwd')
    localStorage.removeItem('rag_sdk_doc_base')
    localStorage.removeItem('rag_sdk_path_prefix')
    setServerCwd('')
    setDocBase('')
    setPathPrefix('')
  }, [])

  // Pipelines state
  const [pipelines, setPipelines] = useState<string[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState<string>('')
  const [newPipelineName, setNewPipelineName] = useState<string>('')
  const [filesInPipeline, setFilesInPipeline] = useState<string[]>([])

  const refreshPipelines = useCallback(async () => {
    try {
      const res = await ragSdkApiService.listPipelines()
      setPipelines(res?.pipelines || [])
      if (res?.pipelines?.length && !selectedPipeline)
        setSelectedPipeline(res.pipelines[0])
    }
    catch (e) {
      // ignore errors for mock UI
    }
  }, [selectedPipeline])

  const refreshFiles = useCallback(async (pipeline?: string) => {
    const name = pipeline || selectedPipeline
    if (!name) return
    try {
      const res = await ragSdkApiService.listFiles(name)
      setFilesInPipeline(res?.files || [])
    }
    catch (e) {
      setFilesInPipeline([])
    }
  }, [selectedPipeline])

  const handleRemoveFileInPipeline = useCallback(async (filePath: string) => {
    if (!selectedPipeline) return
    try {
      await ragSdkApiService.removeFileInPipeline(selectedPipeline, filePath)
      await refreshFiles(selectedPipeline)
    }
    catch (e) {
      // ignore for mock UI, log to console
      console.error('removeFileInPipeline failed', e)
    }
  }, [selectedPipeline, refreshFiles])

  const handleRemoveAllInPipeline = useCallback(async () => {
    if (!selectedPipeline || filesInPipeline.length === 0) return
    try {
      for (const f of filesInPipeline)
        await ragSdkApiService.removeFileInPipeline(selectedPipeline, f)

      await refreshFiles(selectedPipeline)
    }
    catch (e) {
      console.error('remove all files failed', e)
    }
  }, [selectedPipeline, filesInPipeline, refreshFiles])

  useEffect(() => {
    refreshPipelines()
  }, [])

  useEffect(() => {
    if (selectedPipeline)
      refreshFiles(selectedPipeline)
  }, [selectedPipeline])

  const handleCreatePipeline = useCallback(async () => {
    if (!newPipelineName) return
    await ragSdkApiService.createPipeline(newPipelineName)
    // Select the newly created pipeline so files appear under it
    setSelectedPipeline(newPipelineName)
    setNewPipelineName('')
    await refreshPipelines()
  }, [newPipelineName, refreshPipelines])

  const handleRemovePipeline = useCallback(async (name: string) => {
    await ragSdkApiService.removePipeline(name)
    if (name === selectedPipeline) {
      setSelectedPipeline('')
      setFilesInPipeline([])
    }
    await refreshPipelines()
  }, [selectedPipeline, refreshPipelines])

  return (
    <div className="flex h-full flex-col">
      <PageHeader />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl">
          {/* Server Configuration */}
          <div className="mb-8 rounded-lg border p-4">
            <div className="mb-4 flex items-center">
              <RiSettings4Line className="mr-2 text-lg" />
              <h2 className="text-lg font-medium">{t('common.serverConfiguration')}</h2>
            </div>
            <div className="flex items-center">
              <input
                type="text"
                value={serverUrl}
                onChange={handleServerUrlChange}
                className="flex-1 rounded-l-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="http://localhost:40004"
              />
              <button
                onClick={saveServerUrl}
                className="rounded-r-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
              >
                {t('common.save')}
              </button>
            </div>
          </div>

          {/* Developer Settings */}
          <div className="mb-8 rounded-lg border p-4">
            <div className="mb-4">
              <div className="flex items-center">
                <RiSettings4Line className="mr-2 text-lg" />
                <h2 className="text-lg font-medium">开发者设置（file_path 规则）</h2>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                优先使用“Server CWD + Doc Base”来计算相对路径；若未设置，则回退到“Path Prefix + 文件名”。
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center">
                <label className="w-40 text-sm text-gray-700">Server CWD</label>
                <input
                  type="text"
                  value={serverCwd}
                  onChange={e => setServerCwd(e.target.value)}
                  className="flex-1 rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="/Users/you/Projects/dify/dev"
                />
              </div>

              <div className="flex items-center">
                <label className="w-40 text-sm text-gray-700">Doc Base</label>
                <input
                  type="text"
                  value={docBase}
                  onChange={e => setDocBase(e.target.value)}
                  className="flex-1 rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="/Users/you/Downloads"
                />
              </div>

              <div className="flex items-center">
                <label className="w-40 text-sm text-gray-700">Path Prefix（可选）</label>
                <input
                  type="text"
                  value={pathPrefix}
                  onChange={e => setPathPrefix(e.target.value)}
                  className="flex-1 rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="../../../Downloads/"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={clearPathSettings}
                  className="rounded-lg border px-4 py-2 hover:bg-gray-50"
                >
                  清除
                </button>
                <button
                  onClick={savePathSettings}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
                >
                  保存
                </button>
              </div>
            </div>
          </div>

          {/* Pipelines (Knowledge Bases) */}
          <div className="mb-8 rounded-lg border p-4">
            <h2 className="mb-4 text-lg font-medium">Knowledge Bases (Pipelines)</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-700">Pipeline name</label>
                <input
                  type="text"
                  value={newPipelineName}
                  onChange={e => setNewPipelineName(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="my_pipeline"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-700">Select pipeline</label>
                <select
                  value={selectedPipeline}
                  onChange={e => setSelectedPipeline(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="">(none)</option>
                  {pipelines.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={handleCreatePipeline}
                className="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
              >Create</button>
              <button
                onClick={() => refreshPipelines()}
                className="rounded-lg border px-4 py-2 hover:bg-gray-50"
              >Refresh</button>
              {selectedPipeline && (
                <button
                  onClick={() => handleRemovePipeline(selectedPipeline)}
                  className="rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50"
                >Remove selected</button>
              )}
            </div>
            {selectedPipeline && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-md font-medium">Files in: {selectedPipeline}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">{filesInPipeline.length} files</span>
                    <button
                      onClick={() => refreshFiles(selectedPipeline)}
                      className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                    >Refresh files</button>
                    <button
                      onClick={handleRemoveAllInPipeline}
                      className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                      disabled={filesInPipeline.length === 0}
                      title="Remove all files from this pipeline"
                    >Remove all</button>
                  </div>
                </div>
                {filesInPipeline.length === 0 ? (
                  <p className="text-sm text-gray-500">No files yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-gray-700">
                    {filesInPipeline.map(f => (
                      <li key={f} className="flex items-center justify-between">
                        <span className="truncate">{f}</span>
                        <button
                          onClick={() => handleRemoveFileInPipeline(f)}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          title="Remove this file from the pipeline"
                        >Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* File Upload Section */}
          <div className="rounded-lg border p-4">
            <h2 className="mb-4 text-lg font-medium">{t('common.fileUpload')}</h2>
            <FileUploader pipelineName={selectedPipeline} onIndexed={() => refreshFiles()} onRemoved={() => refreshFiles()} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default RagSdkPage
