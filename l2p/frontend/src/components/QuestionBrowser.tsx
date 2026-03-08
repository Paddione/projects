import React, { useState, useEffect, useCallback, useRef } from 'react'
import { apiService } from '../services/apiService'
import { useLocalization } from '../hooks/useLocalization'
import { Category } from '../types'
import styles from '../styles/QuestionBrowser.module.css'

interface BrowseQuestion {
  id: number
  question_text: string
  answers: Array<{ text: string; correct: boolean }>
  explanation?: string
  difficulty: number
  category?: string
  language?: string
  answer_type?: string
  created_at?: string
}

interface QuestionBrowserProps {
  mode: 'standalone' | 'picker'
  onSelect?: (questionIds: number[]) => void
  excludeQuestionIds?: number[]
}

export const QuestionBrowser: React.FC<QuestionBrowserProps> = ({ mode, onSelect, excludeQuestionIds = [] }) => {
  const { t } = useLocalization()
  const [questions, setQuestions] = useState<BrowseQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [isLoading, setIsLoading] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [answerType, setAnswerType] = useState('')
  const [sortBy, setSortBy] = useState<string>('id')
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC')

  // Categories for dropdown
  const [categories, setCategories] = useState<string[]>([])

  // Expanded row
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Selection (picker mode)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // Bulk editing
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkDifficulty, setBulkDifficulty] = useState('')
  const [bulkAnswerType, setBulkAnswerType] = useState('')
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [categoriesData, setCategoriesData] = useState<Category[]>([])

  // Debounce search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [search])

  // Fetch categories once
  useEffect(() => {
    apiService.getCategories().then(res => {
      if (res.success && res.data) {
        setCategoriesData(res.data)
        setCategories(res.data.map(c => c.name))
      }
    })
  }, [])

  // Fetch questions
  const fetchQuestions = useCallback(async () => {
    setIsLoading(true)
    try {
      const filters: {
        category_id?: number; difficulty?: number; answer_type?: string;
        search?: string; page?: number; pageSize?: number; sortBy?: string; sortDir?: 'ASC' | 'DESC';
      } = { page, pageSize, sortBy, sortDir }
      if (debouncedSearch) filters.search = debouncedSearch
      if (category) filters.category_id = parseInt(category, 10)
      if (difficulty) filters.difficulty = parseInt(difficulty, 10)
      if (answerType) filters.answer_type = answerType
      const res = await apiService.browseQuestions(filters)
      if (res.success && res.data) {
        setQuestions(res.data.items || [])
        setTotal(res.data.total || 0)
      }
    } catch (err) {
      console.error('Failed to browse questions:', err)
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, category, difficulty, answerType, page, pageSize, sortBy, sortDir])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC')
    } else {
      setSortBy(col)
      setSortDir('DESC')
    }
    setPage(1)
  }

  const toggleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAddSelected = () => {
    if (onSelect && selected.size > 0) {
      onSelect(Array.from(selected))
      setSelected(new Set())
    }
  }

  const handleBulkApply = async () => {
    const updates: { category_id?: number; difficulty?: number; answer_type?: string } = {}
    if (bulkCategory) updates.category_id = parseInt(bulkCategory, 10)
    if (bulkDifficulty) updates.difficulty = parseInt(bulkDifficulty, 10)
    if (bulkAnswerType) updates.answer_type = bulkAnswerType
    if (Object.keys(updates).length === 0) return

    setIsBulkUpdating(true)
    try {
      const res = await apiService.bulkUpdateQuestions(
        Array.from(selected),
        updates
      )
      if (res.success) {
        setSelected(new Set())
        setBulkCategory('')
        setBulkDifficulty('')
        setBulkAnswerType('')
        fetchQuestions()
      }
    } catch (err) {
      console.error('Bulk update failed:', err)
    } finally {
      setIsBulkUpdating(false)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setCategory('')
    setDifficulty('')
    setAnswerType('')
    setPage(1)
  }

  const hasActiveFilters = search || category || difficulty || answerType

  const getDifficultyClass = (d: number): string => {
    const map: Record<number, string> = { 1: styles.diff1!, 2: styles.diff2!, 3: styles.diff3!, 4: styles.diff4!, 5: styles.diff5! }
    return map[d] || styles.diff3!
  }

  const formatAnswerType = (at?: string): string => {
    if (!at) return 'MC'
    const map: Record<string, string> = {
      multiple_choice: 'MC',
      free_text: 'Free',
      true_false: 'T/F',
      estimation: 'Est.',
      ordering: 'Order',
      matching: 'Match',
      fill_in_blank: 'Fill',
    }
    return map[at] || at
  }

  // Filter out already-linked questions in picker mode
  const displayQuestions = mode === 'picker'
    ? questions.filter(q => !excludeQuestionIds.includes(q.id))
    : questions

  return (
    <div className={styles.container}>
      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>&#128269;</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={t('questionBrowser.searchPlaceholder', 'Search questions...')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={category}
          onChange={e => { setCategory(e.target.value); setPage(1) }}
        >
          <option value="">{t('questionBrowser.allCategories', 'All Categories')}</option>
          {categoriesData.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          className={styles.filterSelect}
          value={difficulty}
          onChange={e => { setDifficulty(e.target.value); setPage(1) }}
        >
          <option value="">{t('questionBrowser.allDifficulties', 'All Difficulties')}</option>
          {[1, 2, 3, 4, 5].map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          className={styles.filterSelect}
          value={answerType}
          onChange={e => { setAnswerType(e.target.value); setPage(1) }}
        >
          <option value="">{t('questionBrowser.allTypes', 'All Types')}</option>
          <option value="multiple_choice">Multiple Choice</option>
          <option value="free_text">Free Text</option>
          <option value="true_false">True/False</option>
          <option value="estimation">Estimation</option>
          <option value="ordering">Ordering</option>
          <option value="matching">Matching</option>
          <option value="fill_in_blank">Fill in Blank</option>
        </select>
        {hasActiveFilters && (
          <button className={styles.clearFilters} onClick={clearFilters} type="button">
            {t('questionBrowser.clearFilters', 'Clear')}
          </button>
        )}
      </div>

      {/* Bulk Action Toolbar */}
      {selected.size > 0 && mode === 'standalone' && (
        <div className={styles.bulkToolbar}>
          <span className={styles.bulkInfo}>
            <span className={styles.selectionCount}>{selected.size}</span> selected
          </span>
          <select className={styles.filterSelect} value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}>
            <option value="">Category...</option>
            {categoriesData.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className={styles.filterSelect} value={bulkDifficulty} onChange={e => setBulkDifficulty(e.target.value)}>
            <option value="">Difficulty...</option>
            {[1,2,3,4,5].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className={styles.filterSelect} value={bulkAnswerType} onChange={e => setBulkAnswerType(e.target.value)}>
            <option value="">Type...</option>
            <option value="multiple_choice">Multiple Choice</option>
            <option value="free_text">Free Text</option>
            <option value="true_false">True/False</option>
            <option value="estimation">Estimation</option>
            <option value="ordering">Ordering</option>
            <option value="matching">Matching</option>
            <option value="fill_in_blank">Fill in Blank</option>
          </select>
          <button
            className={styles.applyBulkButton}
            disabled={isBulkUpdating || (!bulkCategory && !bulkDifficulty && !bulkAnswerType)}
            onClick={handleBulkApply}
            type="button"
          >
            {isBulkUpdating ? 'Applying...' : 'Apply'}
          </button>
          <button className={styles.clearFilters} onClick={() => setSelected(new Set())} type="button">
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className={styles.loadingOverlay}>Loading...</div>
      ) : displayQuestions.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>&#128218;</div>
          <div className={styles.emptyText}>
            {hasActiveFilters
              ? t('questionBrowser.noResults', 'No questions match your filters')
              : t('questionBrowser.empty', 'No questions in the database yet')}
          </div>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkboxCell}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={displayQuestions.length > 0 && selected.size === displayQuestions.length}
                    onChange={() => {
                      if (selected.size === displayQuestions.length) {
                        setSelected(new Set())
                      } else {
                        setSelected(new Set(displayQuestions.map(q => q.id)))
                      }
                    }}
                  />
                </th>
                <th className={styles.sortable} onClick={() => handleSort('id')}>
                  # {sortBy === 'id' && <span className={styles.sortIndicator}>{sortDir === 'ASC' ? '\u25B2' : '\u25BC'}</span>}
                </th>
                <th>Question</th>
                <th>Category</th>
                <th className={styles.sortable} onClick={() => handleSort('difficulty')}>
                  Diff {sortBy === 'difficulty' && <span className={styles.sortIndicator}>{sortDir === 'ASC' ? '\u25B2' : '\u25BC'}</span>}
                </th>
                <th>Type</th>
                <th>Ans</th>
              </tr>
            </thead>
            <tbody>
              {displayQuestions.map(q => {
                const isExpanded = expandedId === q.id
                const answers = Array.isArray(q.answers) ? q.answers : (typeof q.answers === 'string' ? JSON.parse(q.answers) : [])
                return (
                  <React.Fragment key={q.id}>
                    <tr
                      className={isExpanded ? styles.expanded : ''}
                      onClick={() => toggleExpand(q.id)}
                    >
                      <td className={styles.checkboxCell} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={selected.has(q.id)}
                          onChange={() => toggleSelect(q.id)}
                        />
                      </td>
                      <td>{q.id}</td>
                      <td className={styles.questionTextCell}>
                        <div className={styles.truncatedText}>{q.question_text}</div>
                      </td>
                      <td>
                        {q.category && <span className={styles.categoryBadge}>{q.category}</span>}
                      </td>
                      <td>
                        <span className={`${styles.difficultyBadge} ${getDifficultyClass(q.difficulty)}`}>
                          {q.difficulty}
                        </span>
                      </td>
                      <td>
                        <span className={styles.answerTypeBadge}>{formatAnswerType(q.answer_type)}</span>
                      </td>
                      <td className={styles.answerCount}>{answers.length}</td>
                    </tr>
                    {isExpanded && (
                      <tr className={styles.detailRow}>
                        <td colSpan={7}>
                          <div className={styles.detailContent}>
                            <div className={styles.detailFullText}>{q.question_text}</div>
                            <div className={styles.detailAnswers}>
                              {answers.map((a: { text: string; correct: boolean }, i: number) => (
                                <div key={i} className={`${styles.detailAnswer} ${a.correct ? styles.correct : ''}`}>
                                  {a.correct ? '\u2713 ' : ''}{a.text}
                                </div>
                              ))}
                            </div>
                            {q.explanation && (
                              <div className={styles.detailExplanation}>{q.explanation}</div>
                            )}
                            <div className={styles.detailMeta}>
                              {q.category && <span className={styles.categoryBadge}>{q.category}</span>}
                              <span className={`${styles.difficultyBadge} ${getDifficultyClass(q.difficulty)}`}>
                                Difficulty: {q.difficulty}
                              </span>
                              <span className={styles.answerTypeBadge}>{q.answer_type || 'multiple_choice'}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>
            {((page - 1) * pageSize) + 1}&ndash;{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className={styles.pageButtons}>
            <button
              className={styles.pageButton}
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              type="button"
            >
              Prev
            </button>
            <button
              className={styles.pageButton}
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Picker Footer */}
      {mode === 'picker' && (
        <div className={styles.pickerFooter}>
          <span className={styles.selectionInfo}>
            <span className={styles.selectionCount}>{selected.size}</span> question{selected.size !== 1 ? 's' : ''} selected
          </span>
          <button
            className={styles.addSelectedButton}
            disabled={selected.size === 0}
            onClick={handleAddSelected}
            type="button"
          >
            {t('questionBrowser.addSelected', 'Add Selected')}
          </button>
        </div>
      )}
    </div>
  )
}
