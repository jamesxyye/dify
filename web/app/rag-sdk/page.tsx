'use client'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RiSettings4Line } from '@remixicon/react'
import PageHeader from '@/app/components/header'
import FileUploader from '@/app/components/rag-sdk/file-uploader'
import { ragSdkApiService } from '@/service/rag-sdk-api'

const RagSdkPage: React.FC = () => {
  const { t } = useTranslation()
  const [serverUrl, setServerUrl] = useState<string>(ragSdkApiService.getServerUrl() || 'http://localhost:40004')

  const handleServerUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setServerUrl(e.target.value)
  }, [])

  const saveServerUrl = useCallback(() => {
    ragSdkApiService.setServerUrl(serverUrl)
  }, [serverUrl])

  return (
    <div className="flex flex-col h-full">
      <PageHeader title={t('common.ragSdk')} />
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-3xl mx-auto">
          {/* Server Configuration */}
          <div className="mb-8 border rounded-lg p-4">
            <div className="flex items-center mb-4">
              <RiSettings4Line className="text-lg mr-2" />
              <h2 className="text-lg font-medium">{t('common.serverConfiguration')}</h2>
            </div>
            <div className="flex items-center">
              <input
                type="text"
                value={serverUrl}
                onChange={handleServerUrlChange}
                className="flex-1 px-3 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="http://localhost:40004"
              />
              <button
                onClick={saveServerUrl}
                className="px-4 py-2 bg-primary-600 text-white rounded-r-lg hover:bg-primary-700"
              >
                {t('common.save')}
              </button>
            </div>
          </div>

          {/* File Upload Section */}
          <div className="border rounded-lg p-4">
            <h2 className="text-lg font-medium mb-4">{t('common.fileUpload')}</h2>
            <FileUploader />
          </div>
        </div>
      </div>
    </div>
  )
}

export default RagSdkPage