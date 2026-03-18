/**
 * CharacterPicker3D — Character selector for Arena lobby.
 *
 * Shows concept art thumbnails for each character with gender toggle.
 * Concept art served from /assets/concepts/characters/{id}.png (NAS visual-library).
 */

import { useEffect } from 'react';

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

function getConceptUrl(characterId: string, gender: 'male' | 'female'): string {
    const modelId = gender === 'female' ? `${characterId}_f` : characterId;
    return `/assets/concepts/characters/${modelId}.png`;
}

export default function CharacterPicker3D({ selectedCharacter, selectedGender, onSelect }: CharacterPicker3DProps) {
    // Persist selection
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ character: selectedCharacter, gender: selectedGender }));
    }, [selectedCharacter, selectedGender]);

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

            {/* Character grid with concept art icons */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '8px',
                marginBottom: '12px',
            }}>
                {CHARACTERS.map((c) => {
                    const isSelected = selectedCharacter === c.id;
                    return (
                        <button
                            key={c.id}
                            onClick={() => onSelect(c.id, selectedGender)}
                            style={{
                                padding: '6px',
                                background: isSelected ? `${c.color}22` : '#0a0a14',
                                border: `2px solid ${isSelected ? c.color : '#2a2a4a'}`,
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                transition: 'all 0.15s ease',
                                textAlign: 'center',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '4px',
                            }}
                        >
                            <img
                                src={getConceptUrl(c.id, selectedGender)}
                                alt={c.name}
                                style={{
                                    width: '56px',
                                    height: '56px',
                                    objectFit: 'cover',
                                    borderRadius: '6px',
                                    background: '#0a0a1a',
                                    border: isSelected ? `1px solid ${c.color}60` : '1px solid transparent',
                                }}
                                onError={(e) => {
                                    // Fallback: hide broken image, show colored dot
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            <span style={{
                                color: isSelected ? c.color : '#8888aa',
                                fontSize: '0.68rem',
                                fontWeight: isSelected ? 700 : 500,
                                lineHeight: 1.2,
                            }}>
                                {c.name}
                            </span>
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
