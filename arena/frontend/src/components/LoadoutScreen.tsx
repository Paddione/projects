import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import RespectBalance from './RespectBalance';

// ─── Auth service URL resolution ─────────────────────────────────────────────
const env = (window as any).__IMPORT_META_ENV__ || {};
const AUTH_URL =
    import.meta.env?.VITE_AUTH_SERVICE_URL ||
    env.VITE_AUTH_SERVICE_URL ||
    (import.meta.env?.DEV ? 'http://localhost:5500' : '');

// ─── Types ────────────────────────────────────────────────────────────────────

interface Loadout {
    power_up: string | null;
    emote_1: string | null;
    emote_2: string | null;
    emote_3: string | null;
    emote_4: string | null;
    title: string | null;
    border: string | null;
}

interface InventoryItem {
    item_id: string;
    item_type: string;
    item_name: string;
    equipped: boolean;
    purchased_at: string;
}

interface Profile {
    username: string;
    respect_balance: number;
    loadout: Loadout;
    inventory: InventoryItem[];
}

interface CatalogItem {
    id: string;
    item_type: 'power_up' | 'emote' | 'title' | 'border' | 'avatar_skin';
    name: string;
    description: string;
    respect_cost: number;
    rarity: string;
    metadata: Record<string, unknown>;
}

type Tab = 'loadout' | 'store';
type ItemType = 'power_up' | 'emote' | 'title' | 'border' | 'avatar_skin';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${AUTH_URL}${path}`;
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        ...options,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || res.statusText);
    }
    return res.json();
}

const SLOT_LABELS: Record<keyof Loadout, string> = {
    power_up: 'Power-Up',
    emote_1: 'Emote 1',
    emote_2: 'Emote 2',
    emote_3: 'Emote 3',
    emote_4: 'Emote 4',
    title: 'Title',
    border: 'Border',
};

const SLOT_TYPES: Record<keyof Loadout, ItemType> = {
    power_up: 'power_up',
    emote_1: 'emote',
    emote_2: 'emote',
    emote_3: 'emote',
    emote_4: 'emote',
    title: 'title',
    border: 'border',
};

const TYPE_LABELS: Record<ItemType, string> = {
    power_up: 'Power-Ups',
    emote: 'Emotes',
    title: 'Titles',
    border: 'Borders',
    avatar_skin: 'Avatar Skins',
};

const RARITY_COLORS: Record<string, string> = {
    common: '#6b6f94',
    uncommon: '#34d399',
    rare: '#6366f1',
    epic: '#a855f7',
    legendary: '#fbbf24',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingSpinner() {
    return (
        <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>
            Loading...
        </div>
    );
}

function ErrorMessage({ message }: { message: string }) {
    return (
        <div style={{
            padding: 'var(--space-sm) var(--space-md)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-danger)',
            fontSize: '0.9rem',
        }}>
            {message}
        </div>
    );
}

// ─── Slot picker modal ────────────────────────────────────────────────────────

interface SlotPickerProps {
    slotKey: keyof Loadout;
    inventory: InventoryItem[];
    currentValue: string | null;
    onSelect: (slotKey: keyof Loadout, itemId: string | null) => void;
    onClose: () => void;
}

function SlotPicker({ slotKey, inventory, currentValue, onSelect, onClose }: SlotPickerProps) {
    const type = SLOT_TYPES[slotKey];
    const owned = inventory.filter((i) => i.item_type === type);

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.75)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-md)',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-lg)',
                    width: '100%',
                    maxWidth: '480px',
                    maxHeight: '80vh',
                    overflow: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Choose {SLOT_LABELS[slotKey]}</h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            lineHeight: 1,
                        }}
                    >
                        ✕
                    </button>
                </div>

                {owned.length === 0 && (
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: 'var(--space-lg)' }}>
                        No {TYPE_LABELS[type]} owned. Visit the Store to buy some!
                    </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {currentValue && (
                        <button
                            onClick={() => onSelect(slotKey, null)}
                            style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                background: 'transparent',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--color-text-muted)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '0.9rem',
                            }}
                        >
                            — Unequip
                        </button>
                    )}
                    {owned.map((item) => (
                        <button
                            key={item.item_id}
                            onClick={() => onSelect(slotKey, item.item_id)}
                            style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                background: item.item_id === currentValue
                                    ? 'rgba(99, 102, 241, 0.2)'
                                    : 'rgba(255, 255, 255, 0.03)',
                                border: `1px solid ${item.item_id === currentValue ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--color-text)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '0.9rem',
                                fontWeight: item.item_id === currentValue ? 600 : 400,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <span>{item.item_name}</span>
                            {item.item_id === currentValue && (
                                <span style={{ color: 'var(--color-primary)', fontSize: '0.8rem' }}>Equipped</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Loadout Tab ──────────────────────────────────────────────────────────────

interface LoadoutTabProps {
    profile: Profile;
    onLoadoutChange: (updated: Profile) => void;
}

function LoadoutTab({ profile, onLoadoutChange }: LoadoutTabProps) {
    const [activeSlot, setActiveSlot] = useState<keyof Loadout | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSelect = async (slotKey: keyof Loadout, itemId: string | null) => {
        setActiveSlot(null);
        setSaving(true);
        setError('');
        const updatedLoadout = { ...profile.loadout, [slotKey]: itemId };
        try {
            const result = await authFetch<{ loadout: Loadout }>('/api/profile/loadout', {
                method: 'PUT',
                body: JSON.stringify(updatedLoadout),
            });
            onLoadoutChange({ ...profile, loadout: result.loadout });
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const slots = Object.keys(SLOT_LABELS) as (keyof Loadout)[];

    return (
        <div>
            {error && <ErrorMessage message={error} />}
            {saving && (
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'center', marginBottom: 'var(--space-sm)' }}>
                    Saving...
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                {slots.map((slotKey) => {
                    const currentId = profile.loadout[slotKey];
                    const equippedItem = currentId
                        ? profile.inventory.find((i) => i.item_id === currentId)
                        : null;

                    return (
                        <button
                            key={slotKey}
                            onClick={() => setActiveSlot(slotKey)}
                            disabled={saving}
                            style={{
                                background: 'var(--color-bg-card)',
                                border: `1px solid ${equippedItem ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--space-md)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all var(--transition-base)',
                                minHeight: '90px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                            }}
                        >
                            <div style={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                color: 'var(--color-text-muted)',
                                marginBottom: 'var(--space-xs)',
                            }}>
                                {SLOT_LABELS[slotKey]}
                            </div>
                            <div style={{
                                fontSize: '0.9rem',
                                fontWeight: equippedItem ? 600 : 400,
                                color: equippedItem ? 'var(--color-text)' : 'var(--color-text-muted)',
                            }}>
                                {equippedItem ? equippedItem.item_name : 'Empty'}
                            </div>
                            <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--color-primary)',
                                marginTop: 'var(--space-xs)',
                            }}>
                                Click to change
                            </div>
                        </button>
                    );
                })}
            </div>

            {activeSlot && (
                <SlotPicker
                    slotKey={activeSlot}
                    inventory={profile.inventory}
                    currentValue={profile.loadout[activeSlot]}
                    onSelect={handleSelect}
                    onClose={() => setActiveSlot(null)}
                />
            )}
        </div>
    );
}

// ─── Store Tab ────────────────────────────────────────────────────────────────

interface StoreTabProps {
    catalog: CatalogItem[];
    profile: Profile;
    onPurchase: (itemId: string) => void;
}

function StoreTab({ catalog, profile, onPurchase }: StoreTabProps) {
    const [buying, setBuying] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const ownedIds = new Set(profile.inventory.map((i) => i.item_id));

    const handleBuy = async (item: CatalogItem) => {
        if (ownedIds.has(item.id)) return;
        if (profile.respect_balance < item.respect_cost) {
            setError(`Not enough Respect. Need ${item.respect_cost.toLocaleString()}, have ${profile.respect_balance.toLocaleString()}.`);
            return;
        }
        setBuying(item.id);
        setError('');
        setSuccessMsg('');
        try {
            await authFetch('/api/catalog/purchase', {
                method: 'POST',
                body: JSON.stringify({ item_id: item.id }),
            });
            onPurchase(item.id);
            setSuccessMsg(`Purchased "${item.name}"!`);
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBuying(null);
        }
    };

    const typeOrder: ItemType[] = ['power_up', 'emote', 'title', 'border', 'avatar_skin'];
    const grouped = typeOrder.reduce<Record<string, CatalogItem[]>>((acc, type) => {
        const items = catalog.filter((i) => i.item_type === type);
        if (items.length > 0) acc[type] = items;
        return acc;
    }, {});

    return (
        <div>
            {error && <div style={{ marginBottom: 'var(--space-sm)' }}><ErrorMessage message={error} /></div>}
            {successMsg && (
                <div style={{
                    padding: 'var(--space-sm) var(--space-md)',
                    background: 'rgba(52, 211, 153, 0.1)',
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-success)',
                    fontSize: '0.9rem',
                    marginBottom: 'var(--space-sm)',
                }}>
                    {successMsg}
                </div>
            )}

            {Object.entries(grouped).map(([type, items]) => (
                <div key={type} style={{ marginBottom: 'var(--space-xl)' }}>
                    <h3 style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--color-text-secondary)',
                        marginBottom: 'var(--space-md)',
                        paddingBottom: 'var(--space-sm)',
                        borderBottom: '1px solid var(--color-border)',
                    }}>
                        {TYPE_LABELS[type as ItemType]}
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
                        {items.map((item) => {
                            const owned = ownedIds.has(item.id);
                            const isBuying = buying === item.id;
                            const rarityColor = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
                            const canAfford = profile.respect_balance >= item.respect_cost;

                            return (
                                <div
                                    key={item.id}
                                    style={{
                                        background: 'var(--color-bg-card)',
                                        border: `1px solid ${owned ? 'var(--color-success)' : 'var(--color-border)'}`,
                                        borderRadius: 'var(--radius-lg)',
                                        padding: 'var(--space-md)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 'var(--space-sm)',
                                        position: 'relative',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {/* Rarity accent */}
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        height: '3px',
                                        background: rarityColor,
                                        opacity: 0.8,
                                    }} />

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '4px' }}>
                                        <span style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.06em',
                                            color: rarityColor,
                                        }}>
                                            {item.rarity}
                                        </span>
                                        {owned && (
                                            <span style={{
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                padding: '2px 8px',
                                                background: 'rgba(52, 211, 153, 0.15)',
                                                border: '1px solid rgba(52, 211, 153, 0.4)',
                                                borderRadius: 'var(--radius-full)',
                                                color: 'var(--color-success)',
                                            }}>
                                                Owned
                                            </span>
                                        )}
                                    </div>

                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>
                                            {item.name}
                                        </div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                                            {item.description}
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            color: canAfford || owned ? 'var(--color-warning)' : 'var(--color-danger)',
                                            fontFamily: 'var(--font-mono)',
                                            fontWeight: 700,
                                            fontSize: '0.9rem',
                                        }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                                <path d="M12 2L3 7v10l9 5 9-5V7L12 2zm0 2.18L19 8v8l-7 3.91L5 16V8l7-3.82z" />
                                            </svg>
                                            {item.respect_cost.toLocaleString()}
                                        </div>

                                        <button
                                            onClick={() => handleBuy(item)}
                                            disabled={owned || isBuying || !canAfford}
                                            style={{
                                                padding: '6px 14px',
                                                background: owned
                                                    ? 'transparent'
                                                    : canAfford
                                                        ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))'
                                                        : 'rgba(239, 68, 68, 0.15)',
                                                border: owned
                                                    ? '1px solid var(--color-border)'
                                                    : canAfford
                                                        ? 'none'
                                                        : '1px solid rgba(239, 68, 68, 0.4)',
                                                borderRadius: 'var(--radius-md)',
                                                color: owned
                                                    ? 'var(--color-text-muted)'
                                                    : canAfford
                                                        ? 'white'
                                                        : 'var(--color-danger)',
                                                cursor: owned || !canAfford ? 'not-allowed' : 'pointer',
                                                fontSize: '0.82rem',
                                                fontWeight: 600,
                                                opacity: isBuying ? 0.7 : 1,
                                                transition: 'all var(--transition-base)',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {isBuying ? '...' : owned ? 'Owned' : !canAfford ? 'Too costly' : 'Buy'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LoadoutScreen() {
    const navigate = useNavigate();
    const [tab, setTab] = useState<Tab>('loadout');
    const [profile, setProfile] = useState<Profile | null>(null);
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchProfile = useCallback(async () => {
        const data = await authFetch<Profile>('/api/profile');
        setProfile(data);
    }, []);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const [profileData, catalogData] = await Promise.all([
                    authFetch<Profile>('/api/profile'),
                    authFetch<CatalogItem[]>('/api/catalog'),
                ]);
                setProfile(profileData);
                setCatalog(catalogData);
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handlePurchase = async (_itemId: string) => {
        // Refresh profile to get updated balance + inventory
        try {
            await fetchProfile();
        } catch {
            // Non-critical — UI already shows success
        }
    };

    return (
        <div className="page" style={{ overflow: 'auto', alignItems: 'flex-start', padding: 'var(--space-lg)' }}>
            {/* Header */}
            <div style={{
                width: '100%',
                maxWidth: '860px',
                margin: '0 auto',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--space-lg)',
                    flexWrap: 'wrap',
                    gap: 'var(--space-sm)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <button
                            onClick={() => navigate('/')}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-text-muted)',
                                cursor: 'pointer',
                                fontSize: '1.2rem',
                                lineHeight: 1,
                                padding: '4px',
                            }}
                            aria-label="Back to home"
                        >
                            ←
                        </button>
                        <h1 style={{
                            fontSize: '1.4rem',
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                        }}>
                            Loadout & Store
                        </h1>
                    </div>

                    {profile && (
                        <RespectBalance balance={profile.respect_balance} size="lg" />
                    )}
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '2px',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '4px',
                    marginBottom: 'var(--space-lg)',
                    width: 'fit-content',
                }}>
                    {(['loadout', 'store'] as Tab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            style={{
                                padding: '8px 24px',
                                background: tab === t ? 'var(--color-primary)' : 'transparent',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                color: tab === t ? 'white' : 'var(--color-text-secondary)',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                textTransform: 'capitalize',
                                transition: 'all var(--transition-fast)',
                            }}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {loading && <LoadingSpinner />}

                {!loading && error && <ErrorMessage message={error} />}

                {!loading && !error && profile && (
                    <>
                        {tab === 'loadout' && (
                            <LoadoutTab
                                profile={profile}
                                onLoadoutChange={setProfile}
                            />
                        )}
                        {tab === 'store' && (
                            <StoreTab
                                catalog={catalog}
                                profile={profile}
                                onPurchase={handlePurchase}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
