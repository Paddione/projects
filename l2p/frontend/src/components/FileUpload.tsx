import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { apiService } from '../services/apiService';
import './FileUpload.css';

interface FileUploadProps {
  onUploadComplete?: (fileData: Record<string, unknown>) => void;
  onUploadError?: (error: string) => void;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // in bytes
  acceptedFileTypes?: string[];
  className?: string;
}

interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onUploadComplete,
  onUploadError,
  multiple = false,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB
  acceptedFileTypes = ['.md', '.pdf', '.docx', '.html'],
  className = ''
}) => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const token = apiService.getToken();
    if (!token) {
      onUploadError?.('Authentication required');
      return;
    }

    setIsUploading(true);
    const newProgress: UploadProgress[] = acceptedFiles.map(file => ({
      fileId: `${file.name}-${Date.now()}`,
      fileName: file.name,
      progress: 0,
      status: 'uploading'
    }));

    setUploadProgress(prev => [...prev, ...newProgress]);

    try {
      if (multiple && acceptedFiles.length > 1) {
        // Batch upload
        await handleBatchUpload(acceptedFiles, newProgress);
      } else {
        // Single file upload
        for (let i = 0; i < acceptedFiles.length; i++) {
          await handleSingleUpload(acceptedFiles[i]!, newProgress[i]!);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      onUploadError?.(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [multiple, onUploadComplete, onUploadError]);

  const handleSingleUpload = useCallback(async (file: File, progress: UploadProgress) => {
    try {
      // Update progress to processing
      updateProgress(progress.fileId, { status: 'processing', progress: 50 });

      const formData = new FormData();
      formData.append('file', file);

      const response = await apiService.uploadFile(formData);
      
      if (response.success && response.data) {
        updateProgress(progress.fileId, { 
          status: 'completed', 
          progress: 100 
        });
        onUploadComplete?.(response.data);
      } else {
        throw new Error(response.error || 'Upload failed');
      }
    } catch (error) {
      updateProgress(progress.fileId, { 
        status: 'error', 
        progress: 0,
        error: error instanceof Error ? error.message : 'Upload failed'
      });
      throw error;
    }
  }, [onUploadComplete]);

  const handleBatchUpload = useCallback(async (files: File[], progress: UploadProgress[]) => {
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      // Update all to processing
      progress.forEach(p => {
        updateProgress(p.fileId, { status: 'processing', progress: 50 });
      });

      const response = await apiService.uploadFiles(formData);
      
      if (response.success && response.data) {
        // Update successful uploads
        response.data.results.forEach((result: Record<string, unknown>, index: number) => {
          if (index < progress.length) {
            updateProgress(progress[index]!.fileId, { 
              status: 'completed', 
              progress: 100 
            });
            onUploadComplete?.(result);
          }
        });

        // Update failed uploads
        response.data.errors.forEach((error: { originalName: string; error: string }) => {
          const progressItem = progress.find(p => p.fileName === error.originalName);
          if (progressItem) {
            updateProgress(progressItem.fileId, { 
              status: 'error', 
              progress: 0,
              error: error.error
            });
          }
        });
      } else {
        throw new Error(response.error || 'Batch upload failed');
      }
    } catch (error) {
      progress.forEach(p => {
        updateProgress(p.fileId, { 
          status: 'error', 
          progress: 0,
          error: error instanceof Error ? error.message : 'Upload failed'
        });
      });
      throw error;
    }
  }, [onUploadComplete]);

  const updateProgress = (fileId: string, updates: Partial<UploadProgress>) => {
    setUploadProgress(prev => 
      prev.map(p => 
        p.fileId === fileId ? { ...p, ...updates } : p
      )
    );
  };

  useEffect(() => {
    if (uploadProgress.length > 0) {
      const hasActiveUploads = uploadProgress.some(p => 
        p.status === 'uploading' || p.status === 'processing'
      );
      setIsUploading(hasActiveUploads);
    }
  }, [uploadProgress]);



  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple,
    maxFiles,
    maxSize,
    accept: acceptedFileTypes.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
    disabled: isUploading
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onDrop(Array.from(files));
    }
  };

  const removeProgress = (fileId: string) => {
    setUploadProgress(prev => prev.filter(p => p.fileId !== fileId));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return '📄';
      case 'docx': return '📝';
      case 'md': return '📋';
      case 'html': return '🌐';
      default: return '📁';
    }
  };

  const getStatusIcon = (status: UploadProgress['status']): string => {
    switch (status) {
      case 'uploading': return '⏳';
      case 'processing': return '🔄';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '📁';
    }
  };

  return (
    <div className={`file-upload-container ${className}`}>
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`file-upload-dropzone ${isDragActive ? 'drag-active' : ''} ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
      >
        <input {...getInputProps()} />
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedFileTypes.join(',')}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          data-testid="file-input"
        />
        
        <div className="file-upload-content">
          <div className="file-upload-icon">📁</div>
          <h3 className="file-upload-title">
            {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
          </h3>
          <p className="file-upload-subtitle">
            or <button 
              type="button" 
              className="file-upload-browse-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              browse files
            </button>
          </p>
          <div className="file-upload-info">
            <p>Supported formats: {acceptedFileTypes.join(', ')}</p>
            <p>Maximum file size: {formatFileSize(maxSize)}</p>
            {multiple && <p>Maximum files: {maxFiles}</p>}
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="file-upload-progress">
          <h4>Upload Progress</h4>
          {uploadProgress.map((progress) => (
            <div key={progress.fileId} className="file-upload-item">
              <div className="file-upload-item-header">
                <span className="file-icon">{getFileIcon(progress.fileName)}</span>
                <span className="file-name">{progress.fileName}</span>
                <span className="status-icon">{getStatusIcon(progress.status)}</span>
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => removeProgress(progress.fileId)}
                  disabled={progress.status === 'uploading' || progress.status === 'processing'}
                >
                  ×
                </button>
              </div>
              
              <div className="progress-bar-container">
                <div 
                  className={`progress-bar ${progress.status}`}
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              
              <div className="file-upload-item-footer">
                <span className="progress-text">
                  {progress.status === 'completed' && 'Upload complete'}
                  {progress.status === 'processing' && 'Processing...'}
                  {progress.status === 'uploading' && `${progress.progress}% uploaded`}
                  {progress.status === 'error' && progress.error}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Status */}
      {isUploading && (
        <div className="file-upload-status">
          <div className="uploading-indicator">
            <div className="spinner"></div>
            <span>Uploading files...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload; 
