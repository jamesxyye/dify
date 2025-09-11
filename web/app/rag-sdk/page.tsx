'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RiSettings4Line } from '@remixicon/react'
import PageHeader from '@/app/components/header'
import FileUploader from '@/app/components/rag-sdk/file-uploader'
import { ragSdkApiService } from '@/service/rag-sdk-api'

const RagSdkPage: React.FC = () => {
  const { t } = useTranslation()
  const [serverUrl, setServerUrl] = useState<string>(ragSdkApiService.getServerUrl() || 'http://localhost:40004')

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

          {/* File Upload Section */}
          <div className="rounded-lg border p-4">
            <h2 className="mb-4 text-lg font-medium">{t('common.fileUpload')}</h2>
            <FileUploader />
          </div>
        </div>
      </div>
    </div>
  )
}

export default RagSdkPage
