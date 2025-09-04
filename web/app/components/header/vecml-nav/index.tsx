'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import {
  RiDatabase2Fill,
  RiDatabase2Line,
} from '@remixicon/react'

type VecMLNavProps = {
  className?: string
}

const VecMLNav = ({ className }: VecMLNavProps) => {
  const { t } = useTranslation()
  const selectedSegment = useSelectedLayoutSegment()
  const activated = selectedSegment === 'rag-sdk'

  return (
    <Link
      href="/rag-sdk"
      className={`
        ${className}
        ${activated
          ? 'bg-components-main-nav-nav-button-bg-active text-components-main-nav-nav-button-text-active font-semibold shadow-md hover:bg-components-main-nav-nav-button-bg-active-hover'
          : 'text-components-main-nav-nav-button-text hover:bg-components-main-nav-nav-button-bg-hover'
        }
      `}
    >
      {activated ? (
        <RiDatabase2Fill className="h-4 w-4" />
      ) : (
        <RiDatabase2Line className="h-4 w-4" />
      )}
      <div className="ml-2 max-[1024px]:hidden">
        VecML
      </div>
    </Link>
  )
}

export default VecMLNav