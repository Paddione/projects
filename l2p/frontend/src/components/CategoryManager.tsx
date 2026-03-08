import React, { useState, useEffect } from 'react'
import { apiService } from '../services/apiService'
import { Category } from '../types'
import { useFocusTrap } from '../hooks/useFocusTrap'
import styles from '../styles/CategoryManager.module.css'

interface CategoryManagerProps {
  isOpen: boolean
  onClose: () => void
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ isOpen, onClose }) => {
  const [categories, setCategories] = useState<Category[]>([])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const modalRef = useFocusTrap(isOpen, onClose)

  const fetchCategories = async () => {
    setIsLoading(true)
    const res = await apiService.getCategories()
    if (res.success && res.data) setCategories(res.data)
    setIsLoading(false)
  }

  useEffect(() => {
    if (isOpen) fetchCategories()
  }, [isOpen])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setError(null)
    const res = await apiService.createCategory(newName.trim())
    if (res.success) {
      setNewName('')
      fetchCategories()
    } else {
      setError(res.error || 'Failed to create category')
    }
  }

  const handleRename = async (id: number) => {
    if (!editingName.trim()) return
    setError(null)
    const res = await apiService.updateCategory(id, editingName.trim())
    if (res.success) {
      setEditingId(null)
      setEditingName('')
      fetchCategories()
    } else {
      setError(res.error || 'Failed to rename category')
    }
  }

  const handleDelete = async (id: number) => {
    setError(null)
    const res = await apiService.deleteCategory(id)
    if (res.success) {
      fetchCategories()
    } else {
      setError(res.error || 'Failed to delete category')
    }
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} ref={modalRef as React.RefObject<HTMLDivElement>}>
        <div className={styles.header}>
          <h3 className={styles.title}>Manage Categories</h3>
          <button className={styles.closeButton} onClick={onClose} type="button">&times;</button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.list}>
          {isLoading ? (
            <div className={styles.loading}>Loading...</div>
          ) : categories.length === 0 ? (
            <div className={styles.empty}>No categories yet</div>
          ) : (
            categories.map(cat => (
              <div key={cat.id} className={styles.categoryRow}>
                {editingId === cat.id ? (
                  <input
                    className={styles.editInput}
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(cat.id); if (e.key === 'Escape') setEditingId(null) }}
                    autoFocus
                  />
                ) : (
                  <span
                    className={styles.categoryName}
                    onClick={() => { setEditingId(cat.id); setEditingName(cat.name) }}
                    title="Click to rename"
                  >
                    {cat.name}
                  </span>
                )}
                <span className={styles.count}>{cat.question_count} questions</span>
                {editingId === cat.id ? (
                  <div className={styles.actions}>
                    <button className={styles.saveButton} onClick={() => handleRename(cat.id)} type="button">Save</button>
                    <button className={styles.cancelButton} onClick={() => setEditingId(null)} type="button">Cancel</button>
                  </div>
                ) : (
                  <button
                    className={styles.deleteButton}
                    disabled={cat.question_count > 0}
                    onClick={() => handleDelete(cat.id)}
                    title={cat.question_count > 0 ? 'Cannot delete: questions still use this category' : 'Delete category'}
                    type="button"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className={styles.addRow}>
          <input
            className={styles.addInput}
            placeholder="New category name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
          />
          <button className={styles.addButton} onClick={handleCreate} disabled={!newName.trim()} type="button">
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
