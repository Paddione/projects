import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { useLocalization } from '../hooks/useLocalization';
import { LoadingSpinner } from './LoadingSpinner';
import styles from '../styles/DocumentProcessor.module.css';

interface DocumentProcessingStatus {
  fileId: string;
  originalName: string;
  status: 'uploading' | 'processing' | 'chunking' | 'embedding' | 'completed' | 'error';
  progress: number;
  currentStep: string;
  error?: string;
  metadata?: {
    title: string;
    author?: string;
    subject?: string;
    pageCount?: number;
    wordCount?: number;
    chunkCount?: number;
  };
  content?: string;
  chunks?: string[];
}

interface ProcessingOptions extends Record<string, unknown> {
  chunkSize: number;
  chunkOverlap: number;
  preserveFormatting: boolean;
  extractMetadata: boolean;
}

interface DocumentProcessorProps {
  fileId?: string;
  onProcessingComplete?: (fileId: string) => void;
  onProcessingError?: (fileId: string, error: string) => void;
}

export const DocumentProcessor: React.FC<DocumentProcessorProps> = ({
  fileId,
  onProcessingComplete,
  onProcessingError
}) => {
  const { t } = useLocalization();
  const [processingStatus, setProcessingStatus] = useState<DocumentProcessingStatus | null>(null);
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>({
    chunkSize: 1000,
    chunkOverlap: 200,
    preserveFormatting: true,
    extractMetadata: true
  });
  const [showContentPreview, setShowContentPreview] = useState(false);
  const [showChunks, setShowChunks] = useState(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editedMetadata, setEditedMetadata] = useState<{
    title?: string;
    author?: string;
    subject?: string;
    pageCount?: number;
    wordCount?: number;
    chunkCount?: number;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  const loadProcessingStatus = useCallback(async () => {
    if (!fileId) return;

    try {
      setIsLoading(true);
      const response = await apiService.getFileStatus(fileId);

      if (response.success && response.data) {
        setProcessingStatus({
          progress: 0,
          currentStep: '',
          ...response.data,
          status: response.data.status as DocumentProcessingStatus["status"]
        });
        setEditedMetadata(response.data.metadata || {});
        // Check if processing is complete
        if (response.data.status === 'completed' && onProcessingComplete) {
          onProcessingComplete(fileId);
        } else if (response.data.status === 'error' && onProcessingError) {
          onProcessingError(fileId, (response.data as { error?: string }).error || 'Unknown error');
        }
      }
    } catch (error) {
      console.error('Error loading processing status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fileId, onProcessingComplete, onProcessingError]);

  useEffect(() => {
    if (fileId) {
      loadProcessingStatus();
    }
  }, [fileId, loadProcessingStatus]);

  const updateProcessingOptions = async () => {
    if (!fileId) return;

    try {
      setIsLoading(true);
      const response = await apiService.updateFileOptions(fileId, processingOptions);

      if (response.success) {
        // Reload status to see updated processing
        await loadProcessingStatus();
      }
    } catch (error) {
      console.error('Error updating processing options:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateMetadata = async () => {
    if (!fileId) return;

    try {
      setIsLoading(true);
      const response = await apiService.updateFileMetadata(fileId, editedMetadata);

      if (response.success) {
        setIsEditingMetadata(false);
        await loadProcessingStatus();
      }
    } catch (error) {
      console.error('Error updating metadata:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploading': return '#f59e0b';
      case 'processing': return '#3b82f6';
      case 'chunking': return '#8b5cf6';
      case 'embedding': return '#10b981';
      case 'completed': return '#059669';
      case 'error': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading': return '📤';
      case 'processing': return '⚙️';
      case 'chunking': return '✂️';
      case 'embedding': return '🧠';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  if (!processingStatus) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <LoadingSpinner />
          <p>{t('docProcessor.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.statusInfo}>
          <span className={styles.statusIcon} style={{ color: getStatusColor(processingStatus.status) }}>
            {getStatusIcon(processingStatus.status)}
          </span>
          <div className={styles.statusDetails}>
            <h3>{processingStatus.originalName}</h3>
            <p className={styles.statusText}>
              {processingStatus.currentStep || processingStatus.status}
            </p>
          </div>
        </div>

        {processingStatus.status === 'error' && (
          <div className={styles.errorMessage}>
            <p>❌ Processing failed</p>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {processingStatus.status !== 'completed' && processingStatus.status !== 'error' && (
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${processingStatus.progress}%` }}
            />
          </div>
          <span className={styles.progressText}>{Math.round(processingStatus.progress)}%</span>
        </div>
      )}

      {/* Processing Options */}
      {processingStatus.status === 'uploading' && (
        <div className={styles.optionsSection}>
          <h4>{t('docProcessor.processingOptions')}</h4>
          <div className={styles.optionsGrid}>
            <div className={styles.option}>
              <label>Chunk Size:</label>
              <input
                type="number"
                value={processingOptions.chunkSize}
                onChange={(e) => setProcessingOptions({
                  ...processingOptions,
                  chunkSize: parseInt(e.target.value)
                })}
                min="100"
                max="5000"
                step="100"
              />
            </div>

            <div className={styles.option}>
              <label>Chunk Overlap:</label>
              <input
                type="number"
                value={processingOptions.chunkOverlap}
                onChange={(e) => setProcessingOptions({
                  ...processingOptions,
                  chunkOverlap: parseInt(e.target.value)
                })}
                min="0"
                max="1000"
                step="50"
              />
            </div>

            <div className={styles.option}>
              <label>
                <input
                  type="checkbox"
                  checked={processingOptions.preserveFormatting}
                  onChange={(e) => setProcessingOptions({
                    ...processingOptions,
                    preserveFormatting: e.target.checked
                  })}
                />
                Preserve Formatting
              </label>
            </div>

            <div className={styles.option}>
              <label>
                <input
                  type="checkbox"
                  checked={processingOptions.extractMetadata}
                  onChange={(e) => setProcessingOptions({
                    ...processingOptions,
                    extractMetadata: e.target.checked
                  })}
                />
                Extract Metadata
              </label>
            </div>
          </div>

          <button
            className={styles.updateButton}
            onClick={updateProcessingOptions}
            disabled={isLoading}
          >
            {isLoading ? <LoadingSpinner /> : 'Update Options'}
          </button>
        </div>
      )}

      {/* Metadata Display/Edit */}
      {processingStatus.metadata && (
        <div className={styles.metadataSection}>
          <div className={styles.metadataHeader}>
            <h4>{t('docProcessor.metadata')}</h4>
            <button
              className={styles.editButton}
              onClick={() => setIsEditingMetadata(!isEditingMetadata)}
            >
              {isEditingMetadata ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {isEditingMetadata ? (
            <div className={styles.metadataForm}>
              <div className={styles.formRow}>
                <label>Title:</label>
                <input
                  type="text"
                  value={editedMetadata.title || ''}
                  onChange={(e) => setEditedMetadata({
                    ...editedMetadata,
                    title: e.target.value
                  })}
                />
              </div>

              <div className={styles.formRow}>
                <label>Author:</label>
                <input
                  type="text"
                  value={editedMetadata.author || ''}
                  onChange={(e) => setEditedMetadata({
                    ...editedMetadata,
                    author: e.target.value
                  })}
                />
              </div>

              <div className={styles.formRow}>
                <label>Subject:</label>
                <input
                  type="text"
                  value={editedMetadata.subject || ''}
                  onChange={(e) => setEditedMetadata({
                    ...editedMetadata,
                    subject: e.target.value
                  })}
                />
              </div>

              <button
                className={styles.saveButton}
                onClick={updateMetadata}
                disabled={isLoading}
              >
                {isLoading ? <LoadingSpinner /> : 'Save Metadata'}
              </button>
            </div>
          ) : (
            <div className={styles.metadataDisplay}>
              <div className={styles.metadataItem}>
                <strong>Title:</strong> {processingStatus.metadata.title}
              </div>
              {processingStatus.metadata.author && (
                <div className={styles.metadataItem}>
                  <strong>Author:</strong> {processingStatus.metadata.author}
                </div>
              )}
              {processingStatus.metadata.subject && (
                <div className={styles.metadataItem}>
                  <strong>Subject:</strong> {processingStatus.metadata.subject}
                </div>
              )}
              {processingStatus.metadata.pageCount && (
                <div className={styles.metadataItem}>
                  <strong>Pages:</strong> {processingStatus.metadata.pageCount}
                </div>
              )}
              {processingStatus.metadata.wordCount && (
                <div className={styles.metadataItem}>
                  <strong>Words:</strong> {processingStatus.metadata.wordCount.toLocaleString()}
                </div>
              )}
              {processingStatus.metadata.chunkCount && (
                <div className={styles.metadataItem}>
                  <strong>Chunks:</strong> {processingStatus.metadata.chunkCount}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content Preview */}
      {processingStatus.content && (
        <div className={styles.contentSection}>
          <div className={styles.contentHeader}>
            <h4>{t('docProcessor.content')}</h4>
            <button
              className={styles.toggleButton}
              onClick={() => setShowContentPreview(!showContentPreview)}
            >
              {showContentPreview ? 'Hide' : 'Show'} Preview
            </button>
          </div>

          {showContentPreview && (
            <div className={styles.contentPreview}>
              <pre>{processingStatus.content}</pre>
            </div>
          )}
        </div>
      )}

      {/* Chunks Display */}
      {processingStatus.chunks && processingStatus.chunks.length > 0 && (
        <div className={styles.chunksSection}>
          <div className={styles.chunksHeader}>
            <h4>Document Chunks ({processingStatus.chunks.length})</h4>
            <button
              className={styles.toggleButton}
              onClick={() => setShowChunks(!showChunks)}
            >
              {showChunks ? 'Hide' : 'Show'} Chunks
            </button>
          </div>

          {showChunks && (
            <div className={styles.chunksList}>
              {processingStatus.chunks.map((chunk, index) => (
                <div key={index} className={styles.chunkItem}>
                  <div className={styles.chunkHeader}>
                    <strong>Chunk {index + 1}</strong>
                    <span className={styles.chunkSize}>
                      {chunk.length} characters
                    </span>
                  </div>
                  <div className={styles.chunkContent}>
                    {chunk.substring(0, 200)}...
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className={styles.refreshButton}
          onClick={loadProcessingStatus}
          disabled={isLoading}
        >
          {isLoading ? <LoadingSpinner /> : 'Refresh Status'}
        </button>
      </div>
    </div>
  );
}; 