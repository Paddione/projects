import { useEffect, useRef, useState, useCallback } from 'react';
import { getKeybinds } from './KeybindSettings';

export const EMOTE_ICONS: Record<string, string> = {
    emote_wave: '👋',
    emote_gg: '🤝',
    emote_thumbsup: '👍',
    emote_clap: '👏',
    emote_shrug: '🤷',
    emote_taunt: '😤',
    emote_dance: '💃',
    emote_facepalm: '🤦',
};

export const EMOTE_LABELS: Record<string, string> = {
    emote_wave: 'Wave',
    emote_gg: 'GG',
    emote_thumbsup: 'Thumbs Up',
    emote_clap: 'Clap',
    emote_shrug: 'Shrug',
    emote_taunt: 'Taunt',
    emote_dance: 'Dance',
    emote_facepalm: 'Facepalm',
};

// Default equipped emote slots (to be fetched from auth profile later)
const DEFAULT_EQUIPPED: [string, string, string, string] = [
    'emote_wave',
    'emote_gg',
    'emote_thumbsup',
    'emote_clap',
];

interface EmoteWheelProps {
    equippedEmotes?: [string, string, string, string];
    onEmote: (emoteId: string) => void;
}

export default function EmoteWheel({ equippedEmotes = DEFAULT_EQUIPPED, onEmote }: EmoteWheelProps) {
    const [wheelOpen, setWheelOpen] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const wheelKeyRef = useRef<string>('t');
    const wheelHeldRef = useRef(false);

    // Refresh keybind ref when component mounts
    useEffect(() => {
        const binds = getKeybinds();
        wheelKeyRef.current = binds.emoteWheel;
    }, []);

    const triggerEmote = useCallback((emoteId: string) => {
        onEmote(emoteId);
    }, [onEmote]);

    // Keyboard handler — slots 1-4 and wheel hold
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const binds = getKeybinds();
            const key = e.key.toLowerCase();

            // Emote slot hotkeys
            if (key === binds.emote1 && equippedEmotes[0]) {
                triggerEmote(equippedEmotes[0]);
                return;
            }
            if (key === binds.emote2 && equippedEmotes[1]) {
                triggerEmote(equippedEmotes[1]);
                return;
            }
            if (key === binds.emote3 && equippedEmotes[2]) {
                triggerEmote(equippedEmotes[2]);
                return;
            }
            if (key === binds.emote4 && equippedEmotes[3]) {
                triggerEmote(equippedEmotes[3]);
                return;
            }

            // Emote wheel hold
            if (key === binds.emoteWheel && !wheelHeldRef.current) {
                wheelHeldRef.current = true;
                setWheelOpen(true);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const binds = getKeybinds();
            if (e.key.toLowerCase() === binds.emoteWheel) {
                wheelHeldRef.current = false;
                setWheelOpen(false);
                setHoveredIndex(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [equippedEmotes, triggerEmote]);

    if (!wheelOpen) return null;

    // Wheel layout: evenly distributed around a circle
    const allEmotes = Object.keys(EMOTE_ICONS);
    const count = allEmotes.length;
    const RADIUS = 100; // px from center to emote button center
    const CENTER = 160;  // half of the SVG/div size

    const selectEmote = (emoteId: string) => {
        triggerEmote(emoteId);
        setWheelOpen(false);
        wheelHeldRef.current = false;
        setHoveredIndex(null);
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 8000,
                pointerEvents: 'none',
            }}
        >
            {/* Backdrop dim */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                pointerEvents: 'none',
            }} />

            {/* Wheel container */}
            <div style={{
                position: 'relative',
                width: `${CENTER * 2}px`,
                height: `${CENTER * 2}px`,
                pointerEvents: 'auto',
            }}>
                {/* Center label */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#94a3b8',
                    fontSize: '0.75rem',
                    textAlign: 'center',
                    pointerEvents: 'none',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                }}>
                    {hoveredIndex !== null ? EMOTE_LABELS[allEmotes[hoveredIndex]] : 'Emotes'}
                </div>

                {/* Ring lines (decorative) */}
                <svg
                    width={CENTER * 2}
                    height={CENTER * 2}
                    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                >
                    <circle
                        cx={CENTER}
                        cy={CENTER}
                        r={RADIUS - 28}
                        fill="none"
                        stroke="rgba(99,102,241,0.2)"
                        strokeWidth="1"
                    />
                    <circle
                        cx={CENTER}
                        cy={CENTER}
                        r={RADIUS + 28}
                        fill="none"
                        stroke="rgba(99,102,241,0.15)"
                        strokeWidth="1"
                    />
                </svg>

                {allEmotes.map((emoteId, i) => {
                    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
                    const x = CENTER + RADIUS * Math.cos(angle);
                    const y = CENTER + RADIUS * Math.sin(angle);
                    const isHovered = hoveredIndex === i;
                    const isEquipped = equippedEmotes.includes(emoteId as any);

                    return (
                        <button
                            key={emoteId}
                            onClick={() => selectEmote(emoteId)}
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            style={{
                                position: 'absolute',
                                left: `${x}px`,
                                top: `${y}px`,
                                width: '52px',
                                height: '52px',
                                borderRadius: '50%',
                                background: isHovered
                                    ? 'rgba(99,102,241,0.7)'
                                    : isEquipped
                                        ? 'rgba(30,30,60,0.9)'
                                        : 'rgba(20,20,40,0.8)',
                                border: isHovered
                                    ? '2px solid #818cf8'
                                    : isEquipped
                                        ? '1.5px solid rgba(99,102,241,0.5)'
                                        : '1.5px solid rgba(255,255,255,0.12)',
                                cursor: 'pointer',
                                fontSize: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.12s ease',
                                boxShadow: isHovered ? '0 0 16px rgba(99,102,241,0.6)' : 'none',
                                transform: `translate(-50%, -50%) scale(${isHovered ? 1.18 : 1})`,
                            }}
                            title={EMOTE_LABELS[emoteId]}
                        >
                            {EMOTE_ICONS[emoteId]}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
