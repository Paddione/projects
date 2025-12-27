import { create } from 'zustand'

interface FileUploadState {
  uploads: Map<string, {
    fileId: string
    fileName: string
    progress: number
    status: 'uploading' | 'processing' | 'completed' | 'error'
    error?: string
  }>
  isUploading: boolean
  addUpload: (fileId: string, fileName: string) => void
  updateProgress: (fileId: string, progress: number) => void
  updateStatus: (fileId: string, status: 'uploading' | 'processing' | 'completed' | 'error', error?: string) => void
  removeUpload: (fileId: string) => void
  clearUploads: () => void
  setIsUploading: (isUploading: boolean) => void
}

export const useFileUploadStore = create<FileUploadState>((set, _get) => ({
  uploads: new Map(),
  isUploading: false,

  addUpload: (fileId: string, fileName: string) => {
    set((state) => {
      const newUploads = new Map(state.uploads)
      newUploads.set(fileId, {
        fileId,
        fileName,
        progress: 0,
        status: 'uploading'
      })
      return { uploads: newUploads }
    })
  },

  updateProgress: (fileId: string, progress: number) => {
    set((state) => {
      const newUploads = new Map(state.uploads)
      const upload = newUploads.get(fileId)
      if (upload) {
        newUploads.set(fileId, { ...upload, progress })
      }
      return { uploads: newUploads }
    })
  },

  updateStatus: (fileId: string, status: 'uploading' | 'processing' | 'completed' | 'error', error?: string) => {
    set((state) => {
      const newUploads = new Map(state.uploads)
      const upload = newUploads.get(fileId)
      if (upload) {
        const updated: typeof upload = { ...upload, status }
        if (error !== undefined) {
          updated.error = error
        }
        newUploads.set(fileId, updated)
      }
      return { uploads: newUploads }
    })
  },

  removeUpload: (fileId: string) => {
    set((state) => {
      const newUploads = new Map(state.uploads)
      newUploads.delete(fileId)
      return { uploads: newUploads }
    })
  },

  clearUploads: () => {
    set({ uploads: new Map() })
  },

  setIsUploading: (isUploading: boolean) => {
    set({ isUploading })
  }
})) 
