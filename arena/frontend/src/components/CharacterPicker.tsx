import { useEffect } from 'react';

const CHARACTERS = [
    { id: 'student', name: 'Student', color: '#00f2ff' },
    { id: 'researcher', name: 'Researcher', color: '#3eff8b' },
    { id: 'professor', name: 'Professor', color: '#bc13fe' },
    { id: 'dean', name: 'Dean', color: '#ffd700' },
    { id: 'librarian', name: 'Librarian', color: '#ff6b9d' },
];

const STORAGE_KEY = 'arena_character';

interface CharacterPickerProps {
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

export default function CharacterPicker({ selectedCharacter, selectedGender, onSelect }: CharacterPickerProps) {
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
