import { useState } from 'react';
import { QualitySettings, type QualityTier } from '../services/QualitySettings';

const LABELS: Record<QualityTier, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

export function SettingsPanel({ onClose }: { onClose?: () => void }) {
    const [tier, setTier] = useState<QualityTier>(QualitySettings.current.tier);

    const handleChange = (newTier: QualityTier) => {
        QualitySettings.setTier(newTier);
        setTier(newTier);
    };

    return (
        <div style={{
            background: 'rgba(10, 11, 26, 0.95)',
            border: '1px solid rgba(0, 242, 255, 0.3)',
            borderRadius: 8,
            padding: 16,
            minWidth: 200,
        }}>
            <div style={{ color: '#00f2ff', fontWeight: 600, marginBottom: 8 }}>
                Graphics Quality
            </div>
            {(['high', 'medium', 'low'] as const).map((t) => (
                <label key={t} style={{
                    display: 'block',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    color: tier === t ? '#00f2ff' : '#888',
                    background: tier === t ? 'rgba(0, 242, 255, 0.1)' : 'transparent',
                    borderRadius: 4,
                    marginBottom: 2,
                }}>
                    <input
                        type="radio"
                        name="quality"
                        checked={tier === t}
                        onChange={() => handleChange(t)}
                        style={{ marginRight: 8 }}
                    />
                    {LABELS[t]}
                </label>
            ))}
            {onClose && (
                <button
                    onClick={onClose}
                    style={{
                        marginTop: 8,
                        background: 'rgba(0, 242, 255, 0.15)',
                        border: '1px solid rgba(0, 242, 255, 0.3)',
                        color: '#00f2ff',
                        borderRadius: 4,
                        padding: '4px 12px',
                        cursor: 'pointer',
                        width: '100%',
                    }}
                >
                    Close
                </button>
            )}
        </div>
    );
}
