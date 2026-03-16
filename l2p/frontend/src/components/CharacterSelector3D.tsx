/**
 * CharacterSelector3D — 3D character preview for L2P character selection.
 *
 * Uses the shared CharacterViewer (Three.js + OrbitControls) to display
 * the currently selected character model. Characters are read from the
 * Zustand characterStore and displayed as emoji+name grid buttons.
 */

import { useEffect, useRef } from 'react'
import { createCharacterViewer, ModelLoader } from 'shared-3d'
import type { CharacterViewer } from 'shared-3d'
import { useCharacterStore, useAvailableCharacters } from '@/stores/characterStore'

// Shared ModelLoader — one instance for the lifetime of the page.
const loader = new ModelLoader()

interface CharacterSelector3DProps {
  selectedCharacter: string
  onSelect: (characterId: string) => void
}

export function CharacterSelector3D({ selectedCharacter, onSelect }: CharacterSelector3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<CharacterViewer | null>(null)
  const { loadCharacters } = useCharacterStore()
  const availableCharacters = useAvailableCharacters()

  // Load character list on mount if not already populated.
  useEffect(() => {
    if (availableCharacters.length === 0) {
      loadCharacters()
    }
  }, [availableCharacters.length, loadCharacters])

  // Mount viewer once.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const viewer = createCharacterViewer(loader)
    viewer.mount(container)
    viewerRef.current = viewer

    const resizeObserver = new ResizeObserver(() => viewer.resize())
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      viewer.dispose()
      viewerRef.current = null
    }
  }, [])

  // Reload model whenever selection changes.
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    viewer.loadCharacter({
      id: selectedCharacter,
      modelUrl: `/assets/3d/characters/${selectedCharacter}.glb`,
      defaultAnimation: 'idle',
    }).catch(() => {
      // Model not yet available — viewer shows empty scene gracefully.
    })
  }, [selectedCharacter])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
    }}>
      {/* 3D viewport */}
      <div
        ref={containerRef}
        style={{
          width: '260px',
          height: '260px',
          background: '#0d1117',
          border: '1px solid #1e2a3a',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      />

      {/* Character grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
        width: '100%',
        maxWidth: '360px',
      }}>
        {availableCharacters.map((character) => {
          const isSelected = selectedCharacter === character.id
          return (
            <button
              key={character.id}
              onClick={() => onSelect(character.id)}
              title={character.description}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 4px',
                background: isSelected ? '#1e3a5f' : '#0d1117',
                border: `2px solid ${isSelected ? '#4a90d9' : '#1e2a3a'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                color: isSelected ? '#e6f3ff' : '#8899aa',
                fontFamily: 'inherit',
                fontSize: '0.7rem',
                fontWeight: isSelected ? 700 : 400,
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{character.emoji}</span>
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
                textAlign: 'center',
              }}>
                {character.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
