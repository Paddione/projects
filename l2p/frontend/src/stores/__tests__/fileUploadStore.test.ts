import { describe, it, expect, beforeEach } from '@jest/globals'
import { useFileUploadStore } from '../fileUploadStore'

describe('fileUploadStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useFileUploadStore.getState()
    store.clearUploads()
    store.setIsUploading(false)
  })

  describe('Initial state', () => {
    it('should have correct initial values', () => {
      const state = useFileUploadStore.getState()

      expect(state.uploads).toBeInstanceOf(Map)
      expect(state.uploads.size).toBe(0)
      expect(state.isUploading).toBe(false)
    })
  })

  describe('addUpload', () => {
    it('should add a new upload', () => {
      const fileId = 'file-123'
      const fileName = 'test.pdf'

      useFileUploadStore.getState().addUpload(fileId, fileName)

      const state = useFileUploadStore.getState()
      const upload = state.uploads.get(fileId)

      expect(upload).toBeDefined()
      expect(upload?.fileId).toBe(fileId)
      expect(upload?.fileName).toBe(fileName)
      expect(upload?.progress).toBe(0)
      expect(upload?.status).toBe('uploading')
    })

    it('should add multiple uploads', () => {
      useFileUploadStore.getState().addUpload('file-1', 'test1.pdf')
      useFileUploadStore.getState().addUpload('file-2', 'test2.docx')
      useFileUploadStore.getState().addUpload('file-3', 'test3.txt')

      const state = useFileUploadStore.getState()
      expect(state.uploads.size).toBe(3)
      expect(state.uploads.get('file-1')?.fileName).toBe('test1.pdf')
      expect(state.uploads.get('file-2')?.fileName).toBe('test2.docx')
      expect(state.uploads.get('file-3')?.fileName).toBe('test3.txt')
    })
  })

  describe('updateProgress', () => {
    it('should update progress for existing upload', () => {
      const fileId = 'file-123'

      useFileUploadStore.getState().addUpload(fileId, 'test.pdf')
      useFileUploadStore.getState().updateProgress(fileId, 50)

      const state = useFileUploadStore.getState()
      const upload = state.uploads.get(fileId)

      expect(upload?.progress).toBe(50)
    })

    it('should handle progress updates for non-existent upload gracefully', () => {
      // This should not throw an error
      useFileUploadStore.getState().updateProgress('non-existent', 50)

      const state = useFileUploadStore.getState()
      expect(state.uploads.size).toBe(0)
    })

    it('should handle multiple progress updates', () => {
      const fileId = 'file-123'

      useFileUploadStore.getState().addUpload(fileId, 'test.pdf')
      useFileUploadStore.getState().updateProgress(fileId, 25)
      useFileUploadStore.getState().updateProgress(fileId, 50)
      useFileUploadStore.getState().updateProgress(fileId, 75)
      useFileUploadStore.getState().updateProgress(fileId, 100)

      const state = useFileUploadStore.getState()
      const upload = state.uploads.get(fileId)

      expect(upload?.progress).toBe(100)
    })
  })

  describe('updateStatus', () => {
    it('should update status to processing', () => {
      const fileId = 'file-123'

      useFileUploadStore.getState().addUpload(fileId, 'test.pdf')
      useFileUploadStore.getState().updateStatus(fileId, 'processing')

      const state = useFileUploadStore.getState()
      const upload = state.uploads.get(fileId)

      expect(upload?.status).toBe('processing')
    })

    it('should update status to completed', () => {
      const fileId = 'file-123'

      useFileUploadStore.getState().addUpload(fileId, 'test.pdf')
      useFileUploadStore.getState().updateStatus(fileId, 'completed')

      const state = useFileUploadStore.getState()
      const upload = state.uploads.get(fileId)

      expect(upload?.status).toBe('completed')
    })

    it('should update status to error with error message', () => {
      const fileId = 'file-123'
      const errorMessage = 'Upload failed: Network error'

      useFileUploadStore.getState().addUpload(fileId, 'test.pdf')
      useFileUploadStore.getState().updateStatus(fileId, 'error', errorMessage)

      const state = useFileUploadStore.getState()
      const upload = state.uploads.get(fileId)

      expect(upload?.status).toBe('error')
      expect(upload?.error).toBe(errorMessage)
    })

    it('should handle status update for non-existent upload gracefully', () => {
      // This should not throw an error
      useFileUploadStore.getState().updateStatus('non-existent', 'completed')

      const state = useFileUploadStore.getState()
      expect(state.uploads.size).toBe(0)
    })

    it('should update status without error message', () => {
      const fileId = 'file-123'

      useFileUploadStore.getState().addUpload(fileId, 'test.pdf')
      useFileUploadStore.getState().updateStatus(fileId, 'processing')

      const state = useFileUploadStore.getState()
      const upload = state.uploads.get(fileId)

      expect(upload?.status).toBe('processing')
      expect(upload?.error).toBeUndefined()
    })
  })

  describe('removeUpload', () => {
    it('should remove an upload', () => {
      const fileId = 'file-123'

      useFileUploadStore.getState().addUpload(fileId, 'test.pdf')
      expect(useFileUploadStore.getState().uploads.size).toBe(1)

      useFileUploadStore.getState().removeUpload(fileId)

      const state = useFileUploadStore.getState()
      expect(state.uploads.size).toBe(0)
      expect(state.uploads.get(fileId)).toBeUndefined()
    })

    it('should handle removing non-existent upload gracefully', () => {
      // This should not throw an error
      useFileUploadStore.getState().removeUpload('non-existent')

      const state = useFileUploadStore.getState()
      expect(state.uploads.size).toBe(0)
    })

    it('should remove only specified upload from multiple', () => {
      useFileUploadStore.getState().addUpload('file-1', 'test1.pdf')
      useFileUploadStore.getState().addUpload('file-2', 'test2.docx')
      useFileUploadStore.getState().addUpload('file-3', 'test3.txt')

      useFileUploadStore.getState().removeUpload('file-2')

      const state = useFileUploadStore.getState()
      expect(state.uploads.size).toBe(2)
      expect(state.uploads.get('file-1')).toBeDefined()
      expect(state.uploads.get('file-2')).toBeUndefined()
      expect(state.uploads.get('file-3')).toBeDefined()
    })
  })

  describe('clearUploads', () => {
    it('should clear all uploads', () => {
      useFileUploadStore.getState().addUpload('file-1', 'test1.pdf')
      useFileUploadStore.getState().addUpload('file-2', 'test2.docx')
      useFileUploadStore.getState().addUpload('file-3', 'test3.txt')

      useFileUploadStore.getState().clearUploads()

      const state = useFileUploadStore.getState()
      expect(state.uploads.size).toBe(0)
    })

    it('should handle clearing empty uploads', () => {
      useFileUploadStore.getState().clearUploads()

      const state = useFileUploadStore.getState()
      expect(state.uploads.size).toBe(0)
    })
  })

  describe('setIsUploading', () => {
    it('should set isUploading to true', () => {
      useFileUploadStore.getState().setIsUploading(true)

      const state = useFileUploadStore.getState()
      expect(state.isUploading).toBe(true)
    })

    it('should set isUploading to false', () => {
      useFileUploadStore.getState().setIsUploading(true)
      useFileUploadStore.getState().setIsUploading(false)

      const state = useFileUploadStore.getState()
      expect(state.isUploading).toBe(false)
    })
  })

  describe('Complex scenarios', () => {
    it('should handle complete upload lifecycle', () => {
      const fileId = 'file-123'
      const fileName = 'document.pdf'

      // Start upload
      useFileUploadStore.getState().addUpload(fileId, fileName)
      useFileUploadStore.getState().setIsUploading(true)

      let state = useFileUploadStore.getState()
      expect(state.uploads.get(fileId)?.status).toBe('uploading')
      expect(state.isUploading).toBe(true)

      // Update progress
      useFileUploadStore.getState().updateProgress(fileId, 50)
      state = useFileUploadStore.getState()
      expect(state.uploads.get(fileId)?.progress).toBe(50)

      // Change to processing
      useFileUploadStore.getState().updateStatus(fileId, 'processing')
      state = useFileUploadStore.getState()
      expect(state.uploads.get(fileId)?.status).toBe('processing')

      // Complete upload
      useFileUploadStore.getState().updateStatus(fileId, 'completed')
      useFileUploadStore.getState().updateProgress(fileId, 100)
      useFileUploadStore.getState().setIsUploading(false)

      state = useFileUploadStore.getState()
      expect(state.uploads.get(fileId)?.status).toBe('completed')
      expect(state.uploads.get(fileId)?.progress).toBe(100)
      expect(state.isUploading).toBe(false)
    })

    it('should handle upload failure', () => {
      const fileId = 'file-123'
      const fileName = 'document.pdf'
      const errorMessage = 'Upload failed: Network timeout'

      // Start upload
      useFileUploadStore.getState().addUpload(fileId, fileName)
      useFileUploadStore.getState().setIsUploading(true)

      // Simulate failure
      useFileUploadStore.getState().updateStatus(fileId, 'error', errorMessage)
      useFileUploadStore.getState().setIsUploading(false)

      const state = useFileUploadStore.getState()
      expect(state.uploads.get(fileId)?.status).toBe('error')
      expect(state.uploads.get(fileId)?.error).toBe(errorMessage)
      expect(state.isUploading).toBe(false)
    })

    it('should handle multiple concurrent uploads', () => {
      // Add multiple uploads
      useFileUploadStore.getState().addUpload('file-1', 'doc1.pdf')
      useFileUploadStore.getState().addUpload('file-2', 'doc2.docx')
      useFileUploadStore.getState().addUpload('file-3', 'doc3.txt')
      useFileUploadStore.getState().setIsUploading(true)

      // Update progress independently
      useFileUploadStore.getState().updateProgress('file-1', 100)
      useFileUploadStore.getState().updateProgress('file-2', 50)
      useFileUploadStore.getState().updateProgress('file-3', 25)

      // Update statuses independently
      useFileUploadStore.getState().updateStatus('file-1', 'completed')
      useFileUploadStore.getState().updateStatus('file-2', 'processing')
      useFileUploadStore.getState().updateStatus('file-3', 'uploading')

      const state = useFileUploadStore.getState()
      expect(state.uploads.size).toBe(3)
      expect(state.uploads.get('file-1')?.status).toBe('completed')
      expect(state.uploads.get('file-1')?.progress).toBe(100)
      expect(state.uploads.get('file-2')?.status).toBe('processing')
      expect(state.uploads.get('file-2')?.progress).toBe(50)
      expect(state.uploads.get('file-3')?.status).toBe('uploading')
      expect(state.uploads.get('file-3')?.progress).toBe(25)
    })
  })
})
