import { useState, useEffect, useCallback } from 'react';

export interface Keybinds {
    emote1: string;
    emote2: string;
    emote3: string;
    emote4: string;
    emoteWheel: string;
}

const DEFAULT_KEYBINDS: Keybinds = {
    emote1: '1',
    emote2: '2',
    emote3: '3',
    emote4: '4',
    emoteWheel: 't',
};

const STORAGE_KEY = 'arena_keybinds';

export function getKeybinds(): Keybinds {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return { ...DEFAULT_KEYBINDS, ...JSON.parse(stored) };
        }
    } catch {
        // ignore
    }
    return { ...DEFAULT_KEYBINDS };
}

function saveKeybinds(binds: Keybinds) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(binds));
}

const BIND_LABELS: Record<keyof Keybinds, string> = {
    emote1: 'Emote Slot 1',
    emote2: 'Emote Slot 2',
    emote3: 'Emote Slot 3',
    emote4: 'Emote Slot 4',
    emoteWheel: 'Hold for Emote Wheel',
};

interface KeybindSettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function KeybindSettings({ isOpen, onClose }: KeybindSettingsProps) {
    const [binds, setBinds] = useState<Keybinds>(getKeybinds);
    const [rebinding, setRebinding] = useState<keyof Keybinds | null>(null);

    const startRebind = useCallback((key: keyof Keybinds) => {
        setRebinding(key);
    }, []);

    useEffect(() => {
        if (!rebinding) return;

        const handler = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === 'Escape') {
                setRebinding(null);
                return;
            }
            const newKey = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
            setBinds(prev => {
                const updated = { ...prev, [rebinding]: newKey };
                saveKeybinds(updated);
                return updated;
            });
            setRebinding(null);
        };

        window.addEventListener('keydown', handler, { capture: true });
        return () => window.removeEventListener('keydown', handler, { capture: true });
    }, [rebinding]);

    const resetToDefaults = useCallback(() => {
        setBinds({ ...DEFAULT_KEYBINDS });
        saveKeybinds({ ...DEFAULT_KEYBINDS });
        setRebinding(null);
    }, []);

    if (!isOpen) return null;

    const overlayStyle: React.CSSProperties = {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
    };

    const panelStyle: React.CSSProperties = {
        background: 'var(--color-surface, #0f1022)',
        border: '1px solid var(--color-border, #2a2a4a)',
        borderRadius: '12px',
        padding: '28px 32px',
        minWidth: '340px',
        maxWidth: '420px',
        width: '90vw',
    };

    const rowStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        gap: '16px',
    };

    const bindBtnStyle = (active: boolean): React.CSSProperties => ({
        background: active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${active ? '#6366f1' : 'rgba(255,255,255,0.15)'}`,
        borderRadius: '6px',
        color: active ? '#a5b4fc' : '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '0.9rem',
        padding: '6px 14px',
        cursor: 'pointer',
        minWidth: '64px',
        textAlign: 'center',
        transition: 'all 0.15s',
    });

    const labelStyle: React.CSSProperties = {
        color: 'var(--color-text-secondary, #94a3b8)',
        fontSize: '0.9rem',
        flex: 1,
    };

    return (
        <div style={overlayStyle} onClick={rebinding ? () => setRebinding(null) : undefined}>
            <div style={panelStyle} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.04em' }}>
                        Keybind Settings
                    </h2>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem', padding: '2px 6px' }}
                    >
                        ×
                    </button>
                </div>

                <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '20px' }}>
                    Click a key to rebind. Press Escape to cancel.
                </p>

                {(Object.keys(BIND_LABELS) as Array<keyof Keybinds>).map(bindKey => (
                    <div key={bindKey} style={rowStyle}>
                        <span style={labelStyle}>{BIND_LABELS[bindKey]}</span>
                        <button
                            style={bindBtnStyle(rebinding === bindKey)}
                            onClick={() => startRebind(bindKey)}
                        >
                            {rebinding === bindKey ? '...' : binds[bindKey].toUpperCase()}
                        </button>
                    </div>
                ))}

                <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={resetToDefaults}
                        style={{
                            background: 'none',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '6px',
                            color: '#94a3b8',
                            padding: '7px 16px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                        }}
                    >
                        Reset Defaults
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#6366f1',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#fff',
                            padding: '7px 20px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                        }}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
