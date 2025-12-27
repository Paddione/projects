import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { apiService } from '../../services/apiService';

// Mock the API service
jest.mock('../../services/apiService', () => ({
  apiService: {
    getFileStatus: jest.fn(),
    updateFileOptions: jest.fn(),
    getToken: jest.fn(() => 'test-token')
  }
}));

// Mock the LoadingSpinner component
jest.mock('../LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>
}));

// Import the component after all mocks are defined
import { DocumentProcessor } from '../DocumentProcessor';

const mockApiService = apiService as jest.Mocked<typeof apiService>;

describe('DocumentProcessor Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiService.getFileStatus.mockResolvedValue({
      success: true,
      data: {
        fileId: 'test-file-id',
        originalName: 'test.pdf',
        status: 'completed',
        fileType: 'application/pdf',
        fileSize: 1024,
        metadata: {
          title: 'Test Document',
          pageCount: 5,
          wordCount: 1000
        },
        chromaDocumentId: 'test-chroma-id',
        createdAt: '2023-01-01T00:00:00Z'
      }
    });
    mockApiService.updateFileOptions.mockResolvedValue({
      success: true
    });
  });

  describe('Document Processing Status', () => {
    it('should render processing status when fileId is provided', async () => {
      await act(async () => {
        render(<DocumentProcessor fileId="test-file-id" />);
      });

      await waitFor(() => {
        expect(mockApiService.getFileStatus).toHaveBeenCalledWith('test-file-id');
      });
    });

    it('should display file name when processing status is loaded', async () => {
      await act(async () => {
        render(<DocumentProcessor fileId="test-file-id" />);
      });

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });
    });

    it('should handle error states', async () => {
      mockApiService.getFileStatus.mockResolvedValueOnce({
        success: false,
        error: 'Processing failed'
      });

      await act(async () => {
        render(<DocumentProcessor fileId="test-file-id" />);
      });

      await waitFor(() => {
        expect(mockApiService.getFileStatus).toHaveBeenCalledWith('test-file-id');
      });
    });
  });

  describe('Component Rendering', () => {
    it('should render without fileId', () => {
      render(<DocumentProcessor />);
      // Component should render without errors
      expect(screen.getByText('Loading document processing status...')).toBeInTheDocument();
    });

    it('should render with fileId', async () => {
      await act(async () => {
        render(<DocumentProcessor fileId="test-file-id" />);
      });

      await waitFor(() => {
        expect(mockApiService.getFileStatus).toHaveBeenCalledWith('test-file-id');
      });
    });

    it('should show loading state initially', () => {
      render(<DocumentProcessor fileId="test-file-id" />);
      expect(screen.getByText('Loading document processing status...')).toBeInTheDocument();
    });

    it('should display completed status', async () => {
      await act(async () => {
        render(<DocumentProcessor fileId="test-file-id" />);
      });

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
        expect(screen.getByText('completed')).toBeInTheDocument();
      });
    });
  });

  describe('Processing Options', () => {
    it('should display processing options when status is uploading', async () => {
      mockApiService.getFileStatus.mockResolvedValueOnce({
        success: true,
        data: {
          fileId: 'test-file-id',
          originalName: 'test.pdf',
          status: 'uploading',
          fileType: 'application/pdf',
          fileSize: 1024,
          metadata: {},
          chromaDocumentId: 'test-chroma-id',
          createdAt: '2023-01-01T00:00:00Z'
        }
      });

      await act(async () => {
        render(<DocumentProcessor fileId="test-file-id" />);
      });

      await waitFor(() => {
        expect(screen.getByText('Processing Options')).toBeInTheDocument();
        expect(screen.getByText('Chunk Size:')).toBeInTheDocument();
        expect(screen.getByText('Chunk Overlap:')).toBeInTheDocument();
      });
    });

    it('should handle processing options updates', async () => {
      mockApiService.getFileStatus.mockResolvedValueOnce({
        success: true,
        data: {
          fileId: 'test-file-id',
          originalName: 'test.pdf',
          status: 'uploading',
          fileType: 'application/pdf',
          fileSize: 1024,
          metadata: {},
          chromaDocumentId: 'test-chroma-id',
          createdAt: '2023-01-01T00:00:00Z'
        }
      });

      await act(async () => {
        render(<DocumentProcessor fileId="test-file-id" />);
      });

      await waitFor(() => {
        expect(screen.getByText('Processing Options')).toBeInTheDocument();
      });

      const updateButton = screen.getByText('Update Options');
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(mockApiService.updateFileOptions).toHaveBeenCalled();
      });
    });
  });

  describe('Metadata Display', () => {
    it('should display metadata when processing is complete', async () => {
      await act(async () => {
        render(<DocumentProcessor fileId="test-file-id" />);
      });

      await waitFor(() => {
        expect(screen.getByText('Document Metadata')).toBeInTheDocument();
        expect(screen.getByText('Test Document')).toBeInTheDocument();
      });
    });

    it('should allow metadata editing', async () => {
      await act(async () => {
        render(<DocumentProcessor fileId="test-file-id" />);
      });

      await waitFor(() => {
        expect(screen.getByText('Document Metadata')).toBeInTheDocument();
      });

      const editButton = screen.getByText('Edit');
      fireEvent.click(editButton);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when processing fails', async () => {
      mockApiService.getFileStatus.mockResolvedValueOnce({
        success: true,
        data: {
          fileId: 'test-file-id',
          originalName: 'test.pdf',
          status: 'error',
          fileType: 'application/pdf',
          fileSize: 1024,
          metadata: {},
          chromaDocumentId: 'test-chroma-id',
          createdAt: '2023-01-01T00:00:00Z'
        }
      });

      await act(async () => {
        render(<DocumentProcessor fileId="test-file-id" />);
      });

      await waitFor(() => {
        expect(screen.getByText('❌ Processing failed')).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      mockApiService.getFileStatus.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        render(<DocumentProcessor fileId="test-file-id" />);
      });

      await waitFor(() => {
        expect(mockApiService.getFileStatus).toHaveBeenCalledWith('test-file-id');
      });
    });
  });

  describe('Progress Display', () => {
    it('should show progress bar during processing', async () => {
      mockApiService.getFileStatus.mockResolvedValueOnce({
        success: true,
        data: {
          fileId: 'test-file-id',
          originalName: 'test.pdf',
          status: 'processing',
          progress: 50,
          currentStep: 'Processing document',
          fileType: 'application/pdf',
          fileSize: 1024,
          metadata: {},
          chromaDocumentId: 'test-chroma-id',
          createdAt: '2023-01-01T00:00:00Z'
        }
      });

      await act(async () => {
        render(<DocumentProcessor fileId="test-file-id" />);
      });

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      });
    });

    it('should not show progress bar when completed', async () => {
      await act(async () => {
        render(<DocumentProcessor fileId="test-file-id" />);
      });

      await waitFor(() => {
        expect(screen.queryByText('100%')).not.toBeInTheDocument();
      });
    });
  });
});