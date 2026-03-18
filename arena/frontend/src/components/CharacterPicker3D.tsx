/**
 * CharacterPicker3D — 3D character viewer for Arena lobby.
 *
 * Replaces the 2D CharacterPicker with a Three.js viewer showing
 * the selected character model with orbit controls. Includes gender
 * toggle that switches between base and _f model variants.
 */

import { useEffect, useRef } from 'react';
import { createCharacterViewer, ModelLoader } from 'shared-3d';
import type { CharacterViewer } from 'shared-3d';

const CHARACTERS = [
    { id: 'student',    name: 'Student',    color: '#00f2ff' },
    { id: 'researcher', name: 'Researcher', color: '#3eff8b' },
    { id: 'professor',  name: 'Professor',  color: '#bc13fe' },
    { id: 'dean',       name: 'Dean',       color: '#ffd700' },
    { id: 'librarian',  name: 'Librarian',  color: '#ff6b9d' },
];

const STORAGE_KEY = 'arena_character';

interface CharacterPicker3DProps {
    selectedCharacter: string;
    selectedGender: 'male' | 'female';
    onSelect: (character: string, gender: 'male' | 'female') => void;
}

export function loadSavedCharacter(): { character: string; gender: 'male' | 'female' } {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (
                CHARACTERS.some((c) => c.id === parsed.character) &&
                (parsed.gender === 'male' || parsed.gender === 'female')
            ) {
                return parsed;
            }
        }
    } catch {
        // ignore
    }
    return { character: 'student', gender: 'male' };
}

// Shared ModelLoader — one instance for the lifetime of the page.
const loader = new ModelLoader();

export default function CharacterPicker3D({ selectedCharacter, selectedGender, onSelect }: CharacterPicker3DProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<CharacterViewer | null>(null);

    // Persist selection
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ character: selectedCharacter, gender: selectedGender }));
    }, [selectedCharacter, selectedGender]);

    // Mount viewer once.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const viewer = createCharacterViewer(loader);
        viewer.mount(container);
        viewerRef.current = viewer;

        const resizeObserver = new ResizeObserver(() => viewer.resize());
        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
            viewer.dispose();
            viewerRef.current = null;
        };
    }, []);

    // Reload model whenever selection or gender changes.
    const modelId = selectedGender === 'female' ? `${selectedCharacter}_f` : selectedCharacter;
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        viewer.loadCharacter({
            id: modelId,
            modelUrl: `/assets/3d/characters/${modelId}.glb`,
            defaultAnimation: 'idle',
        }).catch(() => {
            // Model not yet available — viewer shows empty scene gracefully.
        });
    }, [modelId]);

    return (
        <div style={{
            background: '#1a1a2e',
            border: '1px solid #2a2a4a',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            width: '100%',
            maxWidth: '420px',
        }}>
            <div style={{
                fontSize: '0.8rem',
                color: '#8888aa',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '10px',
                fontWeight: 600,
            }}>
                Character
            </div>

            {/* 3D viewport */}
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: '240px',
                    background: '#0a0a1a',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    marginBottom: '12px',
                }}
            />

            {/* Character grid */}
            <div style={{
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap',
                marginBottom: '12px',
            }}>
                {CHARACTERS.map((c) => {
                    const isSelected = selectedCharacter === c.id;
                    return (
                        <button
                            key={c.id}
                            onClick={() => onSelect(c.id, selectedGender)}
                            style={{
                                flex: '1 1 auto',
                                minWidth: '70px',
                                padding: '8px 6px',
                                background: isSelected ? `${c.color}22` : '#0a0a14',
                                border: `2px solid ${isSelected ? c.color : '#2a2a4a'}`,
                                borderRadius: '6px',
                                color: isSelected ? c.color : '#8888aa',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: isSelected ? 700 : 500,
                                fontFamily: 'inherit',
                                transition: 'all 0.15s ease',
                                textAlign: 'center',
                            }}
                        >
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: c.color,
                                margin: '0 auto 4px',
                                boxShadow: isSelected ? `0 0 8px ${c.color}80` : 'none',
                            }} />
                            {c.name}
                        </button>
                    );
                })}
            </div>

            {/* Gender toggle */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
            }}>
                <span style={{ fontSize: '0.8rem', color: '#8888aa' }}>Gender</span>
                <div style={{
                    display: 'flex',
                    background: '#0a0a14',
                    borderRadius: '4px',
                    border: '1px solid #2a2a4a',
                    overflow: 'hidden',
                }}>
                    {(['male', 'female'] as const).map((g) => {
                        const isActive = selectedGender === g;
                        return (
                            <button
                                key={g}
                                onClick={() => onSelect(selectedCharacter, g)}
                                style={{
                                    padding: '4px 14px',
                                    background: isActive ? '#00f2ff22' : 'transparent',
                                    border: 'none',
                                    color: isActive ? '#00f2ff' : '#666680',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: isActive ? 700 : 400,
                                    fontFamily: 'inherit',
                                    textTransform: 'capitalize',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                {g}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
