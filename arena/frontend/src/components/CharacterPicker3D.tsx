/**
 * CharacterPicker3D — 3D character preview for Arena character selection.
 *
 * Uses the shared CharacterViewer (Three.js + OrbitControls) to display
 * the currently selected character model. Character buttons are shown as
 * coloured circles beneath the viewer.
 */

import { useEffect, useRef } from 'react';
import { createCharacterViewer, ModelLoader } from 'shared-3d';
import type { CharacterViewer } from 'shared-3d';

const CHARACTERS = [
    { id: 'warrior', name: 'Warrior', color: '#ff4444' },
    { id: 'rogue',   name: 'Rogue',   color: '#3eff8b' },
    { id: 'mage',    name: 'Mage',    color: '#bc13fe' },
    { id: 'tank',    name: 'Tank',    color: '#ffd700' },
];

interface CharacterPicker3DProps {
    selected: string;
    onSelect: (characterId: string) => void;
}

// Shared ModelLoader — one instance for the lifetime of the page.
const loader = new ModelLoader();

export default function CharacterPicker3D({ selected, onSelect }: CharacterPicker3DProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<CharacterViewer | null>(null);

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

    // Reload model whenever selection changes.
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        viewer.loadCharacter({
            id: selected,
            modelUrl: `/assets/3d/characters/${selected}.glb`,
            defaultAnimation: 'idle',
        }).catch(() => {
            // Model not yet available — viewer shows empty scene gracefully.
        });
    }, [selected]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
        }}>
            {/* 3D viewport */}
            <div
                ref={containerRef}
                style={{
                    width: '280px',
                    height: '280px',
                    background: '#0a0a1a',
                    border: '1px solid #2a2a4a',
                    borderRadius: '8px',
                    overflow: 'hidden',
                }}
            />

            {/* Character selection buttons */}
            <div style={{
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
                justifyContent: 'center',
            }}>
                {CHARACTERS.map((c) => {
                    const isSelected = selected === c.id;
                    return (
                        <button
                            key={c.id}
                            onClick={() => onSelect(c.id)}
                            title={c.name}
                            style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '50%',
                                background: isSelected ? `${c.color}33` : '#0a0a14',
                                border: `2px solid ${isSelected ? c.color : '#2a2a4a'}`,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                                padding: 0,
                            }}
                        >
                            <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: c.color,
                                boxShadow: isSelected ? `0 0 10px ${c.color}80` : 'none',
                            }} />
                        </button>
                    );
                })}
            </div>

            {/* Selected name label */}
            <div style={{
                fontSize: '0.85rem',
                color: CHARACTERS.find(c => c.id === selected)?.color ?? '#8888aa',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
            }}>
                {CHARACTERS.find(c => c.id === selected)?.name ?? selected}
            </div>
        </div>
    );
}
