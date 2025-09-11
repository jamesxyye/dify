'use client'
/** @jsxImportSource react */
import React, { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useContextSelector } from 'use-context-selector'
import { RiDeleteBin5Line, RiUploadCloud2Line } from '@remixicon/react'
import { ToastContext } from '@/app/components/base/toast'
import Button from '@/app/components/base/button'
import { formatFileSize } from '@/utils/format'
import { ragSdkApiService } from '@/service/rag-sdk-api'

type FileItemType = {
  name: string
  size: number
  type: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  errorMessage?: string
}

const FileUploader: React.FC = () => {
  const { t } = useTranslation()
  const toast = useContextSelector(ToastContext, (v: any) => v.toast)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dragActive, setDragActive] = useState(false)
  const [fileList, setFileList] = useState<FileItemType[]>([])
  const [uploading, setUploading] = useState(false)
  // track last indexing summary
  const [lastIndexDurationMs, setLastIndexDurationMs] = useState<number | null>(null)
  const [lastIndexedCount, setLastIndexedCount] = useState<number | null>(null)
  const [lastIndexedTotal, setLastIndexedTotal] = useState<number | null>(null)

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.type === 'dragenter' || e.type === 'dragleave' || e.type === 'dragover')
      setDragActive(e.type !== 'dragleave')
  }, [])

  const handleFiles = useCallback((files: File[]) => {
    const newFiles: FileItemType[] = files.map((file: File) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      file,
      progress: 0,
      status: 'pending' as const,
      errorMessage: undefined,
    }))

    setFileList((prev: FileItemType[]) => [...prev, ...newFiles])
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files)
      handleFiles(Array.from(files))

    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [handleFiles])

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const removeFileFromSelection = useCallback((index: number) => {
    setFileList((prev: FileItemType[]) => prev.filter((_: FileItemType, i: number) => i !== index))
  }, [])

  // Index selected files into vector DB using RAG SDK
  const indexFiles = useCallback(async () => {
    if (uploading) return
    setUploading(true)
    // reset last summary before a new run
    setLastIndexDurationMs(null)
    setLastIndexedCount(null)
    setLastIndexedTotal(null)
    const start = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    const toIndex = fileList.filter((f: FileItemType) => f.status !== 'success')
    setLastIndexedTotal(toIndex.length)
    let successCount = 0
    try {
      for (let i = 0; i < fileList.length; i++) {
        const fileItem = fileList[i]
        if (fileItem.status === 'success') continue

        setFileList((prev: FileItemType[]) => prev.map((it: FileItemType, idx: number) => idx === i ? { ...it, status: 'uploading' } : it))
        try {
          await ragSdkApiService.indexFile(fileItem.name)
          successCount += 1
          setFileList((prev: FileItemType[]) => prev.map((it: FileItemType, idx: number) => idx === i ? { ...it, status: 'success', progress: 100 } : it))
        }
        catch (error) {
          setFileList((prev: FileItemType[]) => prev.map((it: FileItemType, idx: number) => idx === i ? { ...it, status: 'error', errorMessage: error instanceof Error ? error.message : 'Index failed' } : it))
        }
      }
      const end = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      const durationMs = end - start
      setLastIndexDurationMs(durationMs)
      setLastIndexedCount(successCount)
      toast({ type: 'success', message: 'Index completed' })
    }
    finally {
      setUploading(false)
    }
  }, [fileList, uploading, toast])

  // Remove selected files from vector DB using RAG SDK
  const removeIndexedFiles = useCallback(async () => {
    if (fileList.length === 0) return
    try {
      for (const item of fileList) {
        await ragSdkApiService.removeFile(item.name)
        // mark this item as pending so it can be indexed again
        setFileList((prev: FileItemType[]) => prev.map((it: FileItemType) => (
          it.name === item.name
            ? { ...it, status: 'pending', progress: 0, errorMessage: undefined }
            : it
        )))
      }
      toast({ type: 'success', message: 'Removed from index' })
    }
    catch (e) {
      toast({ type: 'error', message: e instanceof Error ? e.message : 'Remove failed' })
    }
  }, [fileList, toast])

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <div className="mb-6">
        <h3 className="mb-2 text-lg font-semibold">{t('common.fileUpload.title')}</h3>
        <p className="text-sm text-gray-600">{t('common.fileUpload.description')}</p>
      </div>

      {/* Upload Area */}
      <div
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <RiUploadCloud2Line className="mx-auto mb-4 h-12 w-12 text-gray-400" />
        <div className="mb-4">
          <p className="mb-2 text-lg font-medium text-gray-900">
            {t('common.fileUpload.dragAndDropFiles')}
          </p>
          <p className="text-sm text-gray-600">
            {t('common.fileUpload.supportedFileTypes')}: PDF, TXT, MD, HTML, DOCX, XLSX
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleFileSelect}
          className="mb-4"
        >
          {t('common.fileUpload.selectFiles')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          accept=".pdf,.txt,.md,.html,.docx,.xlsx"
        />
      </div>

      {/* File List */}
      {fileList.length > 0 && (
        <div className="mt-6">
          <h4 className="text-md mb-4 font-medium">{t('common.fileUpload.selectedFiles')}</h4>
          <div className="space-y-2">
            {fileList.map((fileItem: FileItemType, index: number) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex flex-1 items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{fileItem.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(fileItem.size)}</p>
                    <p className="text-sm text-gray-500">Status: {fileItem.status}</p>
                    {fileItem.status === 'uploading' && (
                      <div className="mt-2">
                        <div className="h-2 w-full rounded-full bg-gray-200">
                          <div
                            className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${fileItem.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    {fileItem.status === 'error' && fileItem.errorMessage && (
                      <p className="mt-1 text-sm text-red-600">{fileItem.errorMessage}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeFileFromSelection(index)}
                    className="ml-4 p-1 text-gray-400 hover:text-red-600"
                  >
                    <RiDeleteBin5Line className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Last indexing summary */}
          {lastIndexedCount !== null && lastIndexDurationMs !== null && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm text-green-800">
                Indexed {lastIndexedCount}{lastIndexedTotal !== null ? `/${lastIndexedTotal}` : ''} file{(lastIndexedTotal ?? lastIndexedCount) === 1 ? '' : 's'} in {(lastIndexDurationMs / 1000).toFixed(2)}s
              </p>
            </div>
          )}

          <div className="mt-4 flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={removeIndexedFiles}
              disabled={uploading || fileList.length === 0}
            >
              {/* remove from vector db */}
              Remove
            </Button>
            <Button
              variant="primary"
              onClick={indexFiles}
              disabled={uploading || fileList.length === 0}
            >
              {/* index to vector db */}
              {uploading ? 'Indexing…' : 'Index'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default FileUploader
