import React from 'react'
import { useLocalization } from '../hooks/useLocalization'

export const AdminLogsPage: React.FC = () => {
  const { t } = useLocalization()
  return (
    <div>
      <h1>{t('admin.logs')}</h1>
      <p>{t('admin.logsContent')}</p>
    </div>
  )
}
