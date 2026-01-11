import React, { useState, useEffect } from 'react'
import { apiService } from '../services/apiService'
import { LoadingSpinner } from './LoadingSpinner'
import { QuestionSet, Answer } from '../types'
import { useFocusTrap } from '../hooks/useFocusTrap'
import styles from '../styles/QuestionSetManager.module.css'

interface QuestionSetStats {
  total_questions: number
  avg_difficulty: number
  min_difficulty: number
  max_difficulty: number
}

export const QuestionSetManager: React.FC = () => {
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [selectedSet, setSelectedSet] = useState<QuestionSet | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showImportForm, setShowImportForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  // AI generator removed
  const [stats, setStats] = useState<QuestionSetStats | null>(null)

  // Focus traps for modals
  const editModalRef = useFocusTrap(showEditForm, () => setShowEditForm(false))
  const importModalRef = useFocusTrap(showImportForm, () => setShowImportForm(false))

  // Mobile/compact mode helpers
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false)
  const [compactMode, setCompactMode] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [collapseStats, setCollapseStats] = useState<boolean>(false)
  const [collapseQuestions, setCollapseQuestions] = useState<boolean>(false)

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    difficulty: 'medium'
  })

  const [importData, setImportData] = useState('')
  const [importErrorDetails, setImportErrorDetails] = useState<string[] | null>(null)

  useEffect(() => {
    loadQuestionSets()
  }, [])

  // Track viewport width to adapt UI
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      if (mobile) setCompactMode(true)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const loadQuestionSets = async () => {
    setIsLoading(true)
    setError(null)
    try {
      console.log('Loading question sets...')
      const response = await apiService.getQuestionSets()
      console.log('Question sets response:', response)

      if (response.success && response.data) {
        // Transform the data to match the QuestionSet interface
        const transformedData: QuestionSet[] = response.data.map((set: Record<string, unknown>) => ({
          id: set['id'] as number,
          name: (set['name'] as string) || 'Unnamed Set',
          description: (set['description'] as string) || '',
          category: (set['category'] as string) || 'General',
          difficulty: (set['difficulty'] as string) || 'medium',
          is_active: set['is_active'] !== undefined ? Boolean(set['is_active']) : true,
          ...(set['is_public'] !== undefined ? { is_public: Boolean(set['is_public']) } : {}),
          ...(set['is_featured'] !== undefined ? { is_featured: Boolean(set['is_featured']) } : {}),
          tags: (set['tags'] as string[]) || [],
          metadata: (set['metadata'] as Record<string, unknown>) || {},
          ...(set['owner_id'] !== undefined ? { owner_id: set['owner_id'] as number } : {}),
          ...(set['created_at'] !== undefined ? { created_at: set['created_at'] as string } : {}),
          ...(set['updated_at'] !== undefined ? { updated_at: set['updated_at'] as string } : {}),
        }))
        console.log('Transformed question sets:', transformedData)
        setQuestionSets(transformedData)
      } else {
        console.error('Failed to load question sets:', response.error)
        setError(response.error || 'Failed to load question sets')
      }
    } catch (err) {
      console.error('Error loading question sets:', err)
      setError('Failed to load question sets: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }

  const loadQuestionSetDetails = async (id: number) => {
    setIsLoading(true)
    setError(null)
    try {
      console.log('Loading question set details for ID:', id)
      const response = await apiService.getQuestionSetDetails(id)
      console.log('Question set details response:', response)

      if (response.success && response.data) {
        // Transform the API response to match the QuestionSet type
        const transformedData: QuestionSet = {
          id: response.data.id,
          name: response.data.name,
          description: response.data.description,
          category: response.data.category,
          difficulty: response.data.difficulty,
          is_active: response.data.is_active,
          ...(response.data.is_public !== undefined ? { is_public: response.data.is_public } : {}),
          ...(response.data.is_featured !== undefined ? { is_featured: response.data.is_featured } : {}),
          ...(response.data.tags ? { tags: response.data.tags } : {}),
          ...(response.data.metadata ? { metadata: response.data.metadata } : {}),
          ...(response.data.owner_id !== undefined ? { owner_id: response.data.owner_id } : {}),
          ...(response.data.created_at ? { created_at: response.data.created_at } : {}),
          ...(response.data.updated_at ? { updated_at: response.data.updated_at } : {}),
          questions: response.data.questions?.map(q => ({
            id: q.id,
            // Normalize to simple string-based shape used by UI
            questionText: typeof q.question_text === 'string'
              ? q.question_text
              : (q.question_text?.de || q.question_text?.en || String(q.question_text || '')),
            answers: Array.isArray(q.answers)
              ? q.answers.map((a: any, index: number) => ({
                id: String(index),
                text: typeof a === 'string' ? a : (a?.text ?? String(a ?? '')),
                isCorrect: (a?.is_correct ?? a?.correct) ?? (index === 0)
              }))
              : [],
            explanation: q.explanation
              ? (typeof q.explanation === 'string' ? q.explanation : (q.explanation?.de || q.explanation?.en || ''))
              : undefined,
            difficulty: q.difficulty
          })) || []
        }

        setSelectedSet(transformedData)

        // Load stats
        console.log('Loading stats for question set:', id)
        const statsResponse = await apiService.getQuestionSetStats(id)
        console.log('Stats response:', statsResponse)

        if (statsResponse.success && statsResponse.data) {
          setStats(statsResponse.data)
        } else {
          console.warn('Failed to load stats:', statsResponse.error)
          // Don't set error for stats failure as it's not critical
          setStats(null)
        }
      } else {
        console.error('Failed to load question set details:', response.error)
        setError(response.error || 'Failed to load question set details')
      }
    } catch (err) {
      console.error('Error loading question set details:', err)
      setError('Failed to load question set details: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }

  // Create new set flow removed

  const handleUpdateQuestionSet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSet) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await apiService.updateQuestionSet(selectedSet.id, {
        ...formData,
        is_active: selectedSet.is_active
      })
      if (response.success && response.data) {
        const updatedSet: QuestionSet = {
          id: response.data.id,
          name: response.data.name,
          description: response.data.description,
          category: response.data.category,
          difficulty: response.data.difficulty,
          is_active: response.data.is_active,
          ...(selectedSet.questions ? { questions: selectedSet.questions } : {})
        }
        setQuestionSets(questionSets.map(set =>
          set.id === selectedSet.id ? updatedSet : set
        ))
        setSelectedSet(updatedSet)
        setShowEditForm(false)
        setFormData({ name: '', description: '', category: '', difficulty: 'medium' })
      } else {
        setError(response.error || 'Failed to update question set')
      }
    } catch {
      setError('Failed to update question set')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteQuestionSet = async (id: number) => {
    if (!confirm('Are you sure you want to delete this question set? This action cannot be undone.')) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await apiService.deleteQuestionSet(id)
      if (response.success) {
        setQuestionSets(questionSets.filter(set => set.id !== id))
        if (selectedSet?.id === id) {
          setSelectedSet(null)
          setStats(null)
        }
      } else {
        setError(response.error || 'Failed to delete question set')
      }
    } catch {
      setError('Failed to delete question set')
    } finally {
      setIsLoading(false)
    }
  }

  const handleImportQuestionSet = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setImportErrorDetails(null)

    try {
      if (!importData.trim()) {
        throw new Error('Bitte geben Sie JSON-Daten ein.')
      }

      let parsedData;
      try {
        parsedData = JSON.parse(importData)
      } catch (err) {
        throw new Error('Ungültiges JSON-Format. Bitte überprüfen Sie Ihre Eingabe.')
      }

      // Map various difficulty values to standard English keys
      const difficultyMap: Record<string, string> = {
        'leicht': 'easy',
        'mittel': 'medium',
        'schwer': 'hard',
        'easy': 'easy',
        'medium': 'medium',
        'hard': 'hard',
        'intermediate': 'medium',
        'beginner': 'easy',
        'advanced': 'hard'
      }

      let payload: any = null;

      // Format A: Standard Export/Import Format
      if (parsedData && parsedData.questionSet && Array.isArray(parsedData.questions)) {
        payload = {
          questionSet: {
            ...parsedData.questionSet,
            difficulty: difficultyMap[String(parsedData.questionSet.difficulty || 'medium').toLowerCase()] || 'medium'
          },
          questions: parsedData.questions
        }
      }
      // Format B: Simple format (Flat object with title and questions array)
      else if (parsedData && Array.isArray(parsedData.questions)) {
        payload = {
          questionSet: {
            name: parsedData.title || parsedData.name || 'Import-Set',
            description: parsedData.description || 'Importiert am ' + new Date().toLocaleDateString(),
            category: parsedData.category || 'General',
            difficulty: difficultyMap[String(parsedData.difficulty || 'medium').toLowerCase()] || 'medium'
          },
          questions: parsedData.questions.map((q: any) => ({
            question_text: q.question_text || q.question || q.text || '',
            answers: q.answers || q.options || [],
            explanation: q.explanation || '',
            difficulty: Number(q.difficulty) || 1
          }))
        }
      } else {
        throw new Error('Unbekanntes Datenformat. Das JSON muss entweder ein "questionSet" Objekt und ein "questions" Array enthalten oder ein Hauptobjekt mit einem "questions" Array sein.')
      }

      console.log('Spannender Import-Payload:', payload)
      const response = await apiService.importQuestionSet(payload)

      if (response.success && response.data) {
        // Success!
        const result = response.data as any
        if (result.errors && result.errors.length > 0) {
          // Partial success
          setImportErrorDetails(result.errors)
          setError(`Import teilweise erfolgreich (${result.questionsImported} Fragen). Einige Fragen konnten nicht importiert werden.`)
        } else {
          await loadQuestionSets()
          setShowImportForm(false)
          setImportData('')
          alert(`Erfolgreich importiert: ${result.questionsImported} Fragen.`)
        }
      } else {
        // API error
        setError(response.error || 'Fehler beim Importieren des Fragen-Sets')
        if ((response as any).details) {
          setImportErrorDetails((response as any).details)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein unerwarteter Fehler ist aufgetreten.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportQuestionSet = async (id: number) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await apiService.exportQuestionSet(id)
      if (response.success && response.data) {
        const dataStr = JSON.stringify(response.data, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `question-set-${id}.json`
        link.click()
        URL.revokeObjectURL(url)
      } else {
        setError(response.error || 'Failed to export question set')
      }
    } catch {
      setError('Failed to export question set')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditClick = (set: QuestionSet) => {
    setSelectedSet(set)
    setFormData({
      name: set.name,
      description: set.description,
      category: set.category,
      difficulty: set.difficulty
    })
    setShowEditForm(true)
  }

  const handleSelectSet = (set: QuestionSet) => {
    try {
      console.log('Selecting question set:', set)
      setSelectedSet(set)
      setStats(null) // Clear previous stats
      loadQuestionSetDetails(set.id)
      if (compactMode) {
        setShowDetailsModal(true)
      }
    } catch (err) {
      console.error('Error selecting question set:', err)
      setError('Failed to select question set: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <LoadingSpinner />
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Question Set Manager</h1>
        <div className={styles.actions}>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={() => setShowImportForm(true)}
          >
            Import Set
          </button>
          <button
            className={styles.button}
            aria-pressed={compactMode}
            onClick={() => setCompactMode(v => !v)}
            title="Toggle compact list mode"
          >
            {compactMode ? 'Disable Compact' : 'Enable Compact'}
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <h2>Question Sets</h2>
          <div className={styles.questionSetList}>
            {questionSets.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No question sets found. Create a new one to get started.</p>
              </div>
            ) : (
              questionSets.map(set => (
                <div
                  key={set.id}
                  className={`${styles.questionSetItem} ${selectedSet?.id === set.id ? styles.selected : ''
                    }`}
                  onClick={() => handleSelectSet(set)}
                >
                  <div className={styles.questionSetInfo}>
                    <h3>{set.name || 'Unnamed Set'}</h3>
                    <p>{set.description || 'No description available'}</p>
                    <div className={styles.questionSetMeta}>
                      <span className={styles.category}>{set.category || 'General'}</span>
                      <span className={`${styles.difficulty} ${styles[set.difficulty || 'medium']}`}>
                        {set.difficulty || 'medium'}
                      </span>
                      <span className={`${styles.status} ${set.is_active ? styles.active : styles.inactive}`}>
                        {set.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.questionSetActions}>
                    <button
                      className={styles.actionButton}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditClick(set)
                      }}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      className={styles.actionButton}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleExportQuestionSet(set.id)
                      }}
                      title="Export"
                    >
                      📤
                    </button>
                    <button
                      className={styles.actionButton}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteQuestionSet(set.id)
                      }}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {!compactMode && (
          <div className={styles.mainContent}>
            {selectedSet ? (
              <div className={styles.questionSetDetails}>
                <div className={styles.questionSetHeader}>
                  <h2>{selectedSet.name}</h2>
                  <div className={styles.questionSetMeta}>
                    <span className={styles.category}>{selectedSet.category}</span>
                    <span className={`${styles.difficulty} ${styles[selectedSet.difficulty]}`}>
                      {selectedSet.difficulty}
                    </span>
                    <span className={`${styles.status} ${selectedSet.is_active ? styles.active : styles.inactive}`}>
                      {selectedSet.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <p className={styles.description}>{selectedSet.description}</p>

                {stats && (
                  <div className={styles.stats}>
                    <div className={styles.collapseHeader}>
                      <h3>Statistics</h3>
                      <button className={styles.collapseBtn} onClick={() => setCollapseStats(v => !v)}>
                        {collapseStats ? 'Show' : 'Hide'}
                      </button>
                    </div>
                    <div className={`${styles.statsGrid} ${collapseStats ? styles.hidden : ''}`}>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Total Questions</span>
                        <span className={styles.statValue}>{stats.total_questions}</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Average Difficulty</span>
                        <span className={styles.statValue}>{Number.isFinite(Number(stats.avg_difficulty)) ? Number(stats.avg_difficulty).toFixed(1) : '-'}</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Difficulty Range</span>
                        <span className={styles.statValue}>{stats.min_difficulty} - {stats.max_difficulty}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Metadata Section */}
                <div className={styles.metadata}>
                  <h3>Question Set Details</h3>
                  <div className={styles.metadataGrid}>
                    <div className={styles.metadataItem}>
                      <span className={styles.metadataLabel}>Public</span>
                      <span className={styles.metadataValue}>
                        {selectedSet.is_public ? '✅ Yes' : '❌ No'}
                      </span>
                    </div>
                    <div className={styles.metadataItem}>
                      <span className={styles.metadataLabel}>Featured</span>
                      <span className={styles.metadataValue}>
                        {selectedSet.is_featured ? '⭐ Yes' : '⭐ No'}
                      </span>
                    </div>
                    {selectedSet.tags && selectedSet.tags.length > 0 && (
                      <div className={styles.metadataItem}>
                        <span className={styles.metadataLabel}>Tags</span>
                        <span className={styles.metadataValue}>
                          <div className={styles.tags}>
                            {selectedSet.tags.map((tag, index) => (
                              <span key={index} className={styles.tag}>{tag}</span>
                            ))}
                          </div>
                        </span>
                      </div>
                    )}
                    {selectedSet.created_at && (
                      <div className={styles.metadataItem}>
                        <span className={styles.metadataLabel}>Created</span>
                        <span className={styles.metadataValue}>
                          {new Date(selectedSet.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {selectedSet.updated_at && (
                      <div className={styles.metadataItem}>
                        <span className={styles.metadataLabel}>Last Updated</span>
                        <span className={styles.metadataValue}>
                          {new Date(selectedSet.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {selectedSet.metadata && Object.keys(selectedSet.metadata).length > 0 && (
                      <div className={styles.metadataItem}>
                        <span className={styles.metadataLabel}>Additional Info</span>
                        <span className={styles.metadataValue}>
                          <div className={styles.metadataContent}>
                            {Object.entries(selectedSet.metadata).map(([key, value]) => (
                              <div key={key} className={styles.metadataField}>
                                <strong>{key}:</strong> {JSON.stringify(value)}
                              </div>
                            ))}
                          </div>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedSet.questions && (
                  <div className={styles.questions}>
                    <div className={styles.collapseHeader}>
                      <h3>Questions ({selectedSet.questions.length})</h3>
                      <button className={styles.collapseBtn} onClick={() => setCollapseQuestions(v => !v)}>
                        {collapseQuestions ? 'Show' : 'Hide'}
                      </button>
                    </div>
                    <div className={`${styles.questionList} ${collapseQuestions ? styles.hidden : ''}`}>
                      {selectedSet.questions.map((question, index) => (
                        <div key={question.id} className={styles.questionItem}>
                          <div className={styles.questionHeader}>
                            <span className={styles.questionNumber}>Q{index + 1}</span>
                            <span className={`${styles.difficulty} ${styles[`level${question.difficulty}`]}`}>
                              Level {question.difficulty}
                            </span>
                          </div>
                          <div className={styles.questionText}>
                            {question.questionText || '—'}
                          </div>
                          <div className={styles.questionAnswers}>
                            {question.answers?.map((answer: Answer, answerIndex: number) => (
                              <div
                                key={answerIndex}
                                className={`${styles.answer} ${answer.isCorrect ? styles.correct : ''}`}
                              >
                                {answer.text || '—'}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <h2>Select a Question Set</h2>
                <p>Choose a question set from the sidebar to view its details and manage questions.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Question Set Modal removed */}

      {/* Edit Question Set Modal */}
      {showEditForm && selectedSet && (
        <div className={styles.modal}>
          <div
            className={styles.modalContent}
            ref={editModalRef as React.RefObject<HTMLDivElement>}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-modal-title"
            tabIndex={-1}
          >
            <h2 id="edit-modal-title">Edit Question Set</h2>
            <form onSubmit={handleUpdateQuestionSet}>
              <div className={styles.formGroup}>
                <label htmlFor="edit-name">Name</label>
                <input
                  type="text"
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="edit-description">Description</label>
                <textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="edit-category">Category</label>
                <input
                  type="text"
                  id="edit-category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="edit-difficulty">Difficulty</label>
                <select
                  id="edit-difficulty"
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.buttonPrimary}>
                  Update
                </button>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={() => setShowEditForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Question Set Modal */}
      {showImportForm && (
        <div className={styles.modal}>
          <div
            className={styles.modalContent}
            style={{ maxWidth: '800px' }}
            ref={importModalRef as React.RefObject<HTMLDivElement>}
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-modal-title"
            tabIndex={-1}
          >
            <h2 id="import-modal-title">Fragen-Set Importieren</h2>
            <div className={styles.importInstructions}>
              <p>Fügen Sie JSON-Daten ein, um ein neues Fragen-Set zu erstellen. Unterstützte Formate:</p>
              <details>
                <summary>Standard Format (Exportiertes Set)</summary>
                <pre>{`{
  "questionSet": { "name": "Set Name", "description": "...", "difficulty": "medium" },
  "questions": [
    { 
      "question_text": "Welche Farbe hat der Himmel?", 
      "answers": [
        { "text": "Blau", "correct": true },
        { "text": "Grün", "correct": false }
      ]
    }
  ]
}`}</pre>
              </details>
              <details>
                <summary>Einfaches Format (Liste)</summary>
                <pre>{`{
  "title": "Mein Set",
  "questions": [
    {
      "question": "Frage?",
      "options": [
        { "text": "A", "isCorrect": true },
        { "text": "B", "isCorrect": false }
      ]
    }
  ]
}`}</pre>
              </details>
            </div>

            <form onSubmit={handleImportQuestionSet}>
              <div className={styles.formGroup}>
                <label htmlFor="import-data">JSON Data</label>
                <textarea
                  id="import-data"
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder="JSON hier einfügen..."
                  rows={15}
                  className={styles.jsonTextarea}
                  required
                />
              </div>

              {importErrorDetails && (
                <div className={styles.importErrorDetails}>
                  <h4>Import-Fehler:</h4>
                  <ul>
                    {importErrorDetails.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className={styles.formActions}>
                <button type="submit" className={styles.buttonPrimary} disabled={isLoading}>
                  {isLoading ? 'Importing...' : 'Import'}
                </button>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={() => {
                    setShowImportForm(false)
                    setImportErrorDetails(null)
                    setError(null)
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details modal for compact mode */}
      {compactMode && showDetailsModal && selectedSet && (
        <div className={styles.modal}>
          <div className={styles.modalContent} style={{ maxWidth: '900px', width: '100%' }}>
            <div className={styles.modalHeader}>
              <h2>{selectedSet.name}</h2>
              <button className={styles.closeButton} onClick={() => setShowDetailsModal(false)}>×</button>
            </div>
            {/* Minimal details for compact mode: reuse same sections */}
            <div className={styles.questionSetMeta}>
              <span className={styles.category}>{selectedSet.category}</span>
              <span className={`${styles.difficulty} ${styles[selectedSet.difficulty]}`}>{selectedSet.difficulty}</span>
              <span className={`${styles.status} ${selectedSet.is_active ? styles.active : styles.inactive}`}>
                {selectedSet.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            {selectedSet.description && (
              <p className={styles.description}>{selectedSet.description}</p>
            )}

            {stats && (
              <div className={styles.stats}>
                <div className={styles.collapseHeader}>
                  <h3>Statistics</h3>
                </div>
                <div className={styles.statsGrid}>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Total Questions</span>
                    <span className={styles.statValue}>{stats.total_questions}</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Average Difficulty</span>
                    <span className={styles.statValue}>{Number.isFinite(Number(stats.avg_difficulty)) ? Number(stats.avg_difficulty).toFixed(1) : '-'}</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Difficulty Range</span>
                    <span className={styles.statValue}>{stats.min_difficulty} - {stats.max_difficulty}</span>
                  </div>
                </div>
              </div>
            )}

            {selectedSet.questions && (
              <div className={styles.questions}>
                <div className={styles.collapseHeader}>
                  <h3>Questions ({selectedSet.questions.length})</h3>
                </div>
                <div className={styles.questionList}>
                  {selectedSet.questions.map((question, index) => (
                    <div key={question.id} className={styles.questionItem}>
                      <div className={styles.questionHeader}>
                        <span className={styles.questionNumber}>Q{index + 1}</span>
                        <span className={`${styles.difficulty} ${styles[`level${question.difficulty}`]}`}>Level {question.difficulty}</span>
                      </div>
                      <div className={styles.questionText}>{question.questionText || '—'}</div>
                      <div className={styles.questionAnswers}>
                        {question.answers?.map((answer: Answer, answerIndex: number) => (
                          <div key={answerIndex} className={`${styles.answer} ${answer.isCorrect ? styles.correct : ''}`}>
                            {answer.text || '—'}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Generator removed */}
    </div>
  )
} 
