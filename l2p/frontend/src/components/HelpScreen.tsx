import React, { useState } from 'react'
import { useLocalization } from '../hooks/useLocalization'
import { useFocusTrap } from '../hooks/useFocusTrap'
import styles from '../styles/HelpScreen.module.css'

interface HelpScreenProps {
  isOpen: boolean
  onClose: () => void
}

type HelpSection =
  | 'howToPlay'
  | 'scoring'
  | 'lobbies'
  | 'questionSets'
  | 'leveling'
  | 'perks'
  | 'profile'
  | 'hallOfFame'
  | 'settings'

const SECTIONS: { key: HelpSection; icon: string }[] = [
  { key: 'howToPlay', icon: '\u{1F3AE}' },
  { key: 'scoring', icon: '\u{1F3AF}' },
  { key: 'lobbies', icon: '\u{1F465}' },
  { key: 'questionSets', icon: '\u{1F4DA}' },
  { key: 'leveling', icon: '\u{2B50}' },
  { key: 'perks', icon: '\u{1F9E9}' },
  { key: 'profile', icon: '\u{1F464}' },
  { key: 'hallOfFame', icon: '\u{1F3C6}' },
  { key: 'settings', icon: '\u{2699}\u{FE0F}' },
]

export const HelpScreen: React.FC<HelpScreenProps> = ({ isOpen, onClose }) => {
  const { t } = useLocalization()
  const [activeSection, setActiveSection] = useState<HelpSection>('howToPlay')
  const focusTrapRef = useFocusTrap(isOpen, onClose)

  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div
        className={styles.modal}
        ref={focusTrapRef as React.RefObject<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-screen-title"
        tabIndex={-1}
      >
        <div className={styles.header}>
          <h2 id="help-screen-title">{t('help.fullHelp')}</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label={t('button.close')}
          >
            \u00D7
          </button>
        </div>

        <div className={styles.body}>
          <nav className={styles.sidebar}>
            {SECTIONS.map(({ key, icon }) => (
              <button
                key={key}
                className={`${styles.navItem} ${activeSection === key ? styles.navItemActive : ''}`}
                onClick={() => setActiveSection(key)}
              >
                <span className={styles.navIcon}>{icon}</span>
                <span className={styles.navLabel}>{t(`help.${key === 'settings' ? 'audio' : key}`, key)}</span>
              </button>
            ))}
          </nav>

          <div className={styles.content}>
            {activeSection === 'howToPlay' && <HowToPlaySection />}
            {activeSection === 'scoring' && <ScoringSection />}
            {activeSection === 'lobbies' && <LobbiesSection />}
            {activeSection === 'questionSets' && <QuestionSetsSection />}
            {activeSection === 'leveling' && <LevelingSection />}
            {activeSection === 'perks' && <PerksSection />}
            {activeSection === 'profile' && <ProfileSection />}
            {activeSection === 'hallOfFame' && <HallOfFameSection />}
            {activeSection === 'settings' && <SettingsSection />}
          </div>
        </div>
      </div>
    </div>
  )
}

const HowToPlaySection: React.FC = () => {
  const { t } = useLocalization()
  return (
    <div className={styles.section}>
      <h3>{t('help.howToPlay')}</h3>
      <div className={styles.steps}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <p key={i}>{t(`help.howToPlay.${i}`)}</p>
        ))}
      </div>
    </div>
  )
}

const ScoringSection: React.FC = () => {
  const { t } = useLocalization()
  return (
    <div className={styles.section}>
      <h3>{t('help.scoring')}</h3>
      <div className={styles.highlight}>{t('help.scoring.formula')}</div>
      <p>{t('help.scoring.fast')}</p>
      <p>{t('help.scoring.streak')}</p>
      <p>{t('help.scoring.wrong')}</p>

      <h3>{t('help.multipliers')}</h3>
      <p>{t('help.multipliers.desc')}</p>
      <div className={styles.multiplierGrid}>
        {['1x', '2x', '3x', '4x', '5x'].map(m => (
          <div key={m} className={styles.multiplierItem}>
            <span className={styles.multiplierBadge}>{m}</span>
            <span>{t(`help.multipliers.${m}`)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const LobbiesSection: React.FC = () => {
  const { t } = useLocalization()
  return (
    <div className={styles.section}>
      <h3>{t('help.lobbies')}</h3>
      <ul className={styles.list}>
        <li>{t('help.lobbies.create')}</li>
        <li>{t('help.lobbies.code')}</li>
        <li>{t('help.lobbies.ready')}</li>
        <li>{t('help.lobbies.host')}</li>
        <li>{t('help.lobbies.max')}</li>
      </ul>
    </div>
  )
}

const QuestionSetsSection: React.FC = () => {
  const { t } = useLocalization()
  return (
    <div className={styles.section}>
      <h3>{t('help.questionSets')}</h3>
      <ul className={styles.list}>
        <li>{t('help.questionSets.browse')}</li>
        <li>{t('help.questionSets.create')}</li>
        <li>{t('help.questionSets.import')}</li>
        <li>{t('help.questionSets.select')}</li>
      </ul>
    </div>
  )
}

const LevelingSection: React.FC = () => {
  const { t } = useLocalization()
  return (
    <div className={styles.section}>
      <h3>{t('help.leveling')}</h3>
      <ul className={styles.list}>
        <li>{t('help.leveling.xp')}</li>
        <li>{t('help.leveling.levelup')}</li>
        <li>{t('help.leveling.perks')}</li>
        <li>{t('help.leveling.cap')}</li>
      </ul>
    </div>
  )
}

const PerksSection: React.FC = () => {
  const { t } = useLocalization()
  return (
    <div className={styles.section}>
      <h3>{t('help.perks')}</h3>
      <ul className={styles.list}>
        <li>{t('help.perks.draft')}</li>
        <li>{t('help.perks.dump')}</li>
        <li>{t('help.perks.reset')}</li>
        <li>{t('help.perks.categories')}</li>
        <li>{t('help.perks.balance')}</li>
      </ul>
    </div>
  )
}

const ProfileSection: React.FC = () => {
  const { t } = useLocalization()
  return (
    <div className={styles.section}>
      <h3>{t('help.profile')}</h3>
      <ul className={styles.list}>
        <li>{t('help.profile.character')}</li>
        <li>{t('help.profile.cosmetics')}</li>
        <li>{t('help.profile.avatar')}</li>
        <li>{t('help.profile.skilltree')}</li>
      </ul>
    </div>
  )
}

const HallOfFameSection: React.FC = () => {
  const { t } = useLocalization()
  return (
    <div className={styles.section}>
      <h3>{t('help.hallOfFame')}</h3>
      <ul className={styles.list}>
        <li>{t('help.hallOfFame.desc')}</li>
        <li>{t('help.hallOfFame.submit')}</li>
        <li>{t('help.hallOfFame.leaderboard')}</li>
      </ul>
    </div>
  )
}

const SettingsSection: React.FC = () => {
  const { t } = useLocalization()
  return (
    <div className={styles.section}>
      <h3>{t('help.audio')}</h3>
      <ul className={styles.list}>
        <li>{t('help.audio.master')}</li>
        <li>{t('help.audio.settings')}</li>
        <li>{t('help.audio.mute')}</li>
      </ul>

      <h3>{t('help.language')}</h3>
      <ul className={styles.list}>
        <li>{t('help.language.switch')}</li>
        <li>{t('help.language.auto')}</li>
      </ul>

      <h3>{t('help.themes')}</h3>
      <ul className={styles.list}>
        <li>{t('help.themes.desc')}</li>
        <li>{t('help.themes.unlock')}</li>
      </ul>
    </div>
  )
}

interface HelpButtonProps {
  onClick: () => void
}

export const HelpButton: React.FC<HelpButtonProps> = ({ onClick }) => {
  const { t } = useLocalization()
  return (
    <button
      className={styles.helpButton}
      onClick={onClick}
      aria-label={t('help.title')}
      title={t('help.title')}
    >
      ?
    </button>
  )
}
