import React, { useState, useEffect, useMemo } from 'react'
import { useGameStore } from '../stores/gameStore'
import { apiService } from '../services/apiService'
import { useLocalization } from '../hooks/useLocalization'
import { QuestionSet } from '../types'
import styles from '../styles/QuestionSetSelector.module.css'

interface QuestionSetInfo {
  selectedSets: Array<{ id: number; name: string; questionCount: number }>
  totalQuestions: number
  selectedQuestionCount: number
  maxQuestionCount: number
}

interface QuestionSetSelectorProps {
  className?: string
}

export const QuestionSetSelector: React.FC<QuestionSetSelectorProps> = ({
  className = ''
}) => {
  const { lobbyCode, isHost } = useGameStore()
  const { t } = useLocalization()

  const [availableQuestionSets, setAvailableQuestionSets] = useState<QuestionSet[]>([])
  const [questionSetInfo, setQuestionSetInfo] = useState<QuestionSetInfo | null>(null)
  const [selectedSetIds, setSelectedSetIds] = useState<number[]>([])
  const [questionCount, setQuestionCount] = useState<number>(20)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filtering states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all')

  const categories = useMemo(() => {
    const cats = new Set(availableQuestionSets.map(s => s.category))
    return ['all', ...Array.from(cats)].filter(Boolean)
  }, [availableQuestionSets])

  const filteredSets = useMemo(() => {
    return availableQuestionSets.filter(set => {
      const matchesSearch = set.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        set.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        set.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesCategory = selectedCategory === 'all' || set.category === selectedCategory
      const matchesDifficulty = selectedDifficulty === 'all' || set.difficulty === selectedDifficulty
      return matchesSearch && matchesCategory && matchesDifficulty
    })
  }, [availableQuestionSets, searchTerm, selectedCategory, selectedDifficulty])

  const computedMaxQuestions = useMemo<number>(() => {
    if (!Array.isArray(availableQuestionSets) || selectedSetIds.length === 0) return 0
    return availableQuestionSets
      .filter(set => selectedSetIds.includes(set.id) && set.is_active)
      .reduce((sum, set) => sum + (set.questions?.length || (set.metadata?.['questionCount'] as number) || 0), 0)
  }, [availableQuestionSets, selectedSetIds])

  useEffect(() => {
    if (computedMaxQuestions > 0) {
      setQuestionCount((prev: number) => Math.max(5, Math.min(prev, computedMaxQuestions)))
    }
  }, [computedMaxQuestions])

  const isSelectionTooSmall: boolean = selectedSetIds.length > 0 && computedMaxQuestions < 5

  // Load available question sets
  useEffect(() => {
    const loadQuestionSets = async () => {
      if (!lobbyCode) return

      setIsLoading(true)
      setError(null)

      try {
        const response = await apiService.getAvailableQuestionSets()
        if (response.success && response.data) {
          const raw = response.data
          let list: any[] = []

          if (Array.isArray(raw)) {
            list = raw
          } else if (raw && typeof raw === 'object') {
            const rawObj = raw as any
            list = rawObj.questionSets || rawObj.sets || rawObj.items || []
          }

          setAvailableQuestionSets(list.map((item: any) => ({
            id: item.id,
            name: item.name || 'Unnamed Set',
            category: item.category || 'General',
            difficulty: item.difficulty || 'medium',
            is_active: item.is_active ?? item.isActive ?? true,
            description: item.description || '',
            tags: item.tags || [],
            metadata: item.metadata || { questionCount: item.questionCount || 0 },
            questions: item.questions || []
          })))
        } else {
          setError(response.error || 'Failed to load question sets')
        }
      } catch (err) {
        setError('Failed to load question sets')
        console.error('Load question sets error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadQuestionSets()
  }, [lobbyCode])

  // Load current question set info
  useEffect(() => {
    const loadQuestionSetInfo = async () => {
      if (!lobbyCode) return

      try {
        const response = await apiService.getLobbyQuestionSetInfo(lobbyCode)
        if (response.success && response.data) {
          const top = response.data as any
          const raw = top.questionSetInfo || top
          const normalized: QuestionSetInfo = {
            selectedSets: Array.isArray(raw.selectedSets) ? raw.selectedSets.map((set: any) => ({
              id: set.id,
              name: set.name,
              questionCount: set.questionCount || 0
            })) : [],
            totalQuestions: raw.totalQuestions ?? 0,
            selectedQuestionCount: raw.selectedQuestionCount ?? 20,
            maxQuestionCount: raw.maxQuestionCount ?? 100,
          }

          setQuestionSetInfo(normalized)
          setSelectedSetIds(normalized.selectedSets.map(set => set.id))
          setQuestionCount(normalized.selectedQuestionCount)

          if (normalized.selectedSets.length > 0) {
            useGameStore.getState().setQuestionSetInfo(normalized)
          }
        }
      } catch (err) {
        console.error('Load question set info error:', err)
      }
    }

    loadQuestionSetInfo()
  }, [lobbyCode])

  const handleQuestionSetToggle = (setId: number) => {
    setSelectedSetIds((prev: number[]) => {
      const newSelection = prev.includes(setId)
        ? prev.filter((id: number) => id !== setId)
        : [...prev, setId]

      updateStoreWithCurrentSettings(newSelection, questionCount)
      return newSelection
    })
  }

  const updateStoreWithCurrentSettings = (setIds: number[], count: number) => {
    const selectedSets = availableQuestionSets
      .filter(set => setIds.includes(set.id))
      .map(set => ({
        id: set.id,
        name: set.name,
        questionCount: set.questions?.length || (set.metadata?.['questionCount'] as number) || 0
      }))

    const totalQuestions = selectedSets.reduce((sum, set) => sum + set.questionCount, 0)

    setTimeout(() => {
      useGameStore.getState().setQuestionSetInfo({
        selectedSets,
        totalQuestions,
        selectedQuestionCount: Math.min(count, totalQuestions),
        maxQuestionCount: totalQuestions
      })
    }, 0)
  }

  const handleQuestionCountChange = (count: number) => {
    const newCount = Math.max(5, Math.min(count, computedMaxQuestions || 100))
    setQuestionCount(newCount)
    updateStoreWithCurrentSettings(selectedSetIds, newCount)
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'var(--success-color, #10b981)'
      case 'medium': return 'var(--warning-color, #f59e0b)'
      case 'hard': return 'var(--error-color, #ef4444)'
      default: return 'var(--text-secondary, #6b7280)'
    }
  }

  if (!isHost) {
    return (
      <div className={`${styles.questionSetSelector} ${className}`}>
        <h3 className={styles.sectionTitle}>{t('selector.selectedQuestions')}</h3>
        {questionSetInfo && (
          <div className={styles.infoDisplay}>
            <div className={styles.selectedSetsList}>
              {(questionSetInfo.selectedSets?.length ?? 0) > 0 ? (
                questionSetInfo.selectedSets.map(set => (
                  <div key={set.id} className={styles.setInfoPill}>
                    <span className={styles.setNamePill}>{set.name}</span>
                    <span className={styles.setCountPill}>{set.questionCount} Qs</span>
                  </div>
                ))
              ) : (
                <p className={styles.noSets}>{t('selector.noSetsSelected')}</p>
              )}
            </div>
            <div className={styles.finalQuestionCount}>
              <span>{t('selector.playingWith')} <strong>{questionSetInfo.selectedQuestionCount}</strong> {t('selector.questions')}</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`${styles.questionSetSelector} ${className}`}>
      <div className={styles.selectorHeader}>
        <h3 className={styles.sectionTitle}>{t('selector.management')}</h3>
        <div className={styles.selectionSummary}>
          {selectedSetIds.length} {t('selector.setsSelected')} ({computedMaxQuestions} {t('selector.totalQs')})
        </div>
      </div>

      <div className={styles.filtersSection}>
        <div className={styles.searchWrapper}>
          <input
            type="text"
            placeholder={t('selector.searchSets')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          <span className={styles.searchIcon}>🔍</span>
        </div>

        <div className={styles.filterControls}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">{t('selector.allCategories')}</option>
            {categories.map(cat => cat !== 'all' && (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">{t('selector.allDifficulties')}</option>
            <option value="easy">{t('selector.easy')}</option>
            <option value="medium">{t('selector.medium')}</option>
            <option value="hard">{t('selector.hard')}</option>
          </select>
        </div>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.listContainer}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>{t('selector.fetchingSets')}</p>
          </div>
        ) : (
          <div className={styles.setsGrid}>
            {filteredSets.length === 0 ? (
              <p className={styles.noResults}>{t('selector.noResults')}</p>
            ) : (
              filteredSets.map(set => (
                <div
                  key={set.id}
                  className={`${styles.setCard} ${selectedSetIds.includes(set.id) ? styles.selectedCard : ''} ${!set.is_active ? styles.inactiveCard : ''}`}
                  onClick={() => set.is_active && handleQuestionSetToggle(set.id)}
                >
                  <div className={styles.cardCheckbox}>
                    <div className={`${styles.customCheck} ${selectedSetIds.includes(set.id) ? styles.checked : ''}`}></div>
                  </div>

                  <div className={styles.cardContent}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardName}>{set.name}</span>
                      <span
                        className={styles.difficultyBadge}
                        style={{ backgroundColor: getDifficultyColor(set.difficulty) }}
                      >
                        {set.difficulty}
                      </span>
                    </div>

                    <div className={styles.cardMeta}>
                      <span className={styles.categoryLabel}>{set.category}</span>
                      <span className={styles.countLabel}>
                        {set.questions?.length || (set.metadata?.['questionCount'] as number) || 0} {t('selector.questions')}
                      </span>
                    </div>

                    {set.tags && set.tags.length > 0 && (
                      <div className={styles.tagsList}>
                        {set.tags.slice(0, 3).map(tag => (
                          <span key={tag} className={styles.tag}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className={styles.configSection}>
        <div className={styles.configHeader}>
          <h4>{t('selector.gameSettings')}</h4>
          <span className={styles.configValue}>{questionCount} {t('selector.questionsCount')}</span>
        </div>

        <div className={styles.sliderControl}>
          <input
            type="range"
            min="5"
            max={Math.max(5, computedMaxQuestions)}
            value={questionCount}
            onChange={(e) => handleQuestionCountChange(parseInt(e.target.value))}
            className={styles.modernSlider}
            disabled={computedMaxQuestions < 5}
          />
          <div className={styles.sliderLabels}>
            <span>5</span>
            <span>{computedMaxQuestions} {t('selector.max')}</span>
          </div>
        </div>

        {isSelectionTooSmall && (
          <div className={styles.warningMessage}>
            {'⚠️ ' + t('selector.needMoreQuestions')}
          </div>
        )}
      </div>
    </div>
  )
}
