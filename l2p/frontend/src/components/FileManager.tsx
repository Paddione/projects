import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import './FileManager.css';

interface FileData {
  fileId: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    pageCount?: number;
    wordCount?: number;
    chunkCount?: number;
    [key: string]: unknown;
  };
  chromaDocumentId: string;
  createdAt: string;
}

interface FileManagerProps {
  onFileSelect?: (file: FileData) => void;
  onFileDelete?: (fileId: string) => void;
  className?: string;
}

const FileManager: React.FC<FileManagerProps> = ({
  onFileSelect,
  onFileDelete,
  className = ''
}) => {
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());

  const fileTypes = ['all', 'pdf', 'docx', 'md', 'html'];

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      if (fileTypeFilter !== 'all') {
        params.append('type', fileTypeFilter);
      }

      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const response = await apiService.getFiles(params);

      if (response.success && response.data) {
        setFiles(response.data.files);
        setTotalPages(response.data.pagination.pages);
      } else {
        setError(response.error || 'Failed to load files');
      }
    } catch (error) {
      console.error('Error loading files:', error);
      setError('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, fileTypeFilter, sortBy, sortOrder]);

  useEffect(() => {
    const token = apiService.getToken();
    if (token) {
      loadFiles();
    }
  }, [loadFiles]);

  const handleFileDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingFiles(prev => new Set(prev).add(fileId));

      const response = await apiService.deleteFile(fileId);

      if (response.success) {
        setFiles(prev => prev.filter(file => file.fileId !== fileId));
        onFileDelete?.(fileId);
      } else {
        setError(response.error || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      setError('Failed to delete file');
    } finally {
      setDeletingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  };

  const handleFileSelect = (file: FileData) => {
    onFileSelect?.(file);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (fileType: string): string => {
    switch (fileType) {
      case 'pdf': return '📄';
      case 'docx': return '📝';
      case 'markdown': return '📋';
      case 'html': return '🌐';
      default: return '📁';
    }
  };

  const getFileTypeLabel = (fileType: string): string => {
    switch (fileType) {
      case 'pdf': return 'PDF';
      case 'docx': return 'Word Document';
      case 'markdown': return 'Markdown';
      case 'html': return 'HTML';
      default: return fileType.toUpperCase();
    }
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.originalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (file.metadata?.title && typeof file.metadata.title === 'string' && file.metadata.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = fileTypeFilter === 'all' || file.fileType === fileTypeFilter;
    return matchesSearch && matchesType;
  });

  if (loading && files.length === 0) {
    return (
      <div className={`file-manager-container ${className}`}>
        <div className="file-manager-loading">
          <div className="spinner"></div>
          <p>Loading files...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`file-manager-container ${className}`}>
      {/* Header */}
      <div className="file-manager-header">
        <h2>Uploaded Files</h2>
        <button
          className="refresh-btn"
          onClick={loadFiles}
          disabled={loading}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Filters and Search */}
      <div className="file-manager-controls">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filters-container">
          <select
            value={fileTypeFilter}
            onChange={(e) => setFileTypeFilter(e.target.value)}
            className="filter-select"
          >
            {fileTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : getFileTypeLabel(type)}
              </option>
            ))}
          </select>

          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [sort, order] = e.target.value.split('-');
              setSortBy(sort as 'name' | 'date' | 'size' | 'type');
              setSortOrder(order as 'asc' | 'desc');
            }}
            className="sort-select"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="size-desc">Largest First</option>
            <option value="size-asc">Smallest First</option>
            <option value="type-asc">Type A-Z</option>
            <option value="type-desc">Type Z-A</option>
          </select>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="file-manager-error">
          <p>❌ {error}</p>
          <button onClick={loadFiles}>Retry</button>
        </div>
      )}

      {/* Files List */}
      <div className="file-manager-content">
        {filteredFiles.length === 0 ? (
          <div className="file-manager-empty">
            <div className="empty-icon">📁</div>
            <h3>No files found</h3>
            <p>
              {searchTerm || fileTypeFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Upload some files to get started'
              }
            </p>
          </div>
        ) : (
          <div className="files-list">
            {filteredFiles.map((file) => (
              <div key={file.fileId} className="file-item">
                <div className="file-item-main" onClick={() => handleFileSelect(file)}>
                  <div className="file-icon">{getFileIcon(file.fileType)}</div>
                  <div className="file-info">
                    <h4 className="file-name">{file.originalName}</h4>
                    <div className="file-meta">
                      <span className="file-type">{getFileTypeLabel(file.fileType)}</span>
                      <span className="file-size">{formatFileSize(file.fileSize)}</span>
                      <span className="file-date">{formatDate(file.createdAt)}</span>
                    </div>
                    {file.metadata?.title && typeof file.metadata.title === 'string' && (
                      <p className="file-title">{file.metadata.title}</p>
                    )}
                    {file.metadata?.wordCount && typeof file.metadata.wordCount === 'number' && (
                      <span className="file-words">{file.metadata.wordCount} words</span>
                    )}
                  </div>
                </div>

                <div className="file-actions">
                  <button
                    className="delete-btn"
                    onClick={() => handleFileDelete(file.fileId)}
                    disabled={deletingFiles.has(file.fileId)}
                    title="Delete file"
                  >
                    {deletingFiles.has(file.fileId) ? '🗑️' : '🗑️'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="file-manager-pagination">
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            ← Previous
          </button>

          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>

          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default FileManager; 