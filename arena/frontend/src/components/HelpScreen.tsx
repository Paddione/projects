import { useState, useEffect, useRef } from 'react';

type HelpSection = 'howToPlay' | 'controls' | 'weapons' | 'mechanics' | 'characters' | 'progression' | 'lobby' | 'spectator';

const SECTIONS: { key: HelpSection; icon: string; label: string }[] = [
    { key: 'howToPlay', icon: '\u{1F3AE}', label: 'How to Play' },
    { key: 'controls', icon: '\u{2328}\u{FE0F}', label: 'Controls' },
    { key: 'weapons', icon: '\u{1F52B}', label: 'Weapons' },
    { key: 'mechanics', icon: '\u{2699}\u{FE0F}', label: 'Game Mechanics' },
    { key: 'characters', icon: '\u{1F9D1}', label: 'Characters' },
    { key: 'progression', icon: '\u{1F4C8}', label: 'Progression' },
    { key: 'lobby', icon: '\u{1F465}', label: 'Lobby' },
    { key: 'spectator', icon: '\u{1F440}', label: 'Spectator' },
];

function Kbd({ children }: { children: string }) {
    return <kbd className="help-kbd">{children}</kbd>;
}

function HowToPlaySection() {
    return (
        <div className="help-section">
            <h3>How to Play</h3>
            <div className="help-steps">
                <p>1. Create or join a lobby from the home screen using a 6-character code.</p>
                <p>2. The host configures match settings (map, rounds, zone, items, NPCs).</p>
                <p>3. All players must ready up before the host can start the game.</p>
                <p>4. Eliminate opponents with guns or melee attacks. Last one standing wins the round.</p>
                <p>5. Pick up health packs, armor, and weapons that spawn on the map.</p>
                <p>6. Survive the shrinking zone (if enabled) to win!</p>
            </div>
        </div>
    );
}

function ControlsSection() {
    return (
        <div className="help-section">
            <h3>Keyboard & Mouse</h3>
            <div className="help-key-grid">
                <div className="help-key-row">
                    <span className="help-key-combo"><Kbd>W</Kbd> <Kbd>A</Kbd> <Kbd>S</Kbd> <Kbd>D</Kbd></span>
                    <span className="help-key-desc">Move</span>
                </div>
                <div className="help-key-row">
                    <span className="help-key-combo"><Kbd>{'\u2191'}</Kbd> <Kbd>{'\u2190'}</Kbd> <Kbd>{'\u2193'}</Kbd> <Kbd>{'\u2192'}</Kbd></span>
                    <span className="help-key-desc">Move (alternative)</span>
                </div>
                <div className="help-key-row">
                    <span className="help-key-combo">Mouse aim</span>
                    <span className="help-key-desc">Aim direction</span>
                </div>
                <div className="help-key-row">
                    <span className="help-key-combo">Left click</span>
                    <span className="help-key-desc">Shoot</span>
                </div>
                <div className="help-key-row">
                    <span className="help-key-combo">Right click / <Kbd>E</Kbd></span>
                    <span className="help-key-desc">Melee attack (instant kill)</span>
                </div>
                <div className="help-key-row">
                    <span className="help-key-combo"><Kbd>Shift</Kbd></span>
                    <span className="help-key-desc">Sprint (hold)</span>
                </div>
                <div className="help-key-row">
                    <span className="help-key-combo"><Kbd>Q</Kbd> / Scroll wheel</span>
                    <span className="help-key-desc">Switch weapon</span>
                </div>
            </div>

            <h3>Touch Controls (Mobile)</h3>
            <div className="help-key-grid">
                <div className="help-key-row">
                    <span className="help-key-combo">Left joystick</span>
                    <span className="help-key-desc">Move</span>
                </div>
                <div className="help-key-row">
                    <span className="help-key-combo">Right joystick</span>
                    <span className="help-key-desc">Aim + shoot (drag to fire)</span>
                </div>
                <div className="help-key-row">
                    <span className="help-key-combo">{'\u{1F5E1}\u{FE0F}'} button</span>
                    <span className="help-key-desc">Melee attack</span>
                </div>
                <div className="help-key-row">
                    <span className="help-key-combo">{'\u{1F3C3}'} button</span>
                    <span className="help-key-desc">Toggle sprint</span>
                </div>
            </div>
        </div>
    );
}

function WeaponsSection() {
    return (
        <div className="help-section">
            <h3>Weapons</h3>
            <div className="help-key-grid">
                <div className="help-key-row">
                    <span className="help-key-combo">{'\u{1F52B}'} Pistol</span>
                    <span className="help-key-desc">Default weapon, unlimited ammo, 1 damage per shot</span>
                </div>
                <div className="help-key-row">
                    <span className="help-key-combo">{'\u{1F52B}'} Machine Gun</span>
                    <span className="help-key-desc">Rapid fire, limited ammo, 1 damage per shot</span>
                </div>
                <div className="help-key-row">
                    <span className="help-key-combo">{'\u{1F4A3}'} Grenade Launcher</span>
                    <span className="help-key-desc">Explosive AOE, limited ammo, 1 damage</span>
                </div>
                <div className="help-key-row">
                    <span className="help-key-combo">{'\u{1F5E1}\u{FE0F}'} Melee</span>
                    <span className="help-key-desc">Instant kill (even through armor), close range only</span>
                </div>
            </div>

            <h3>Switching Weapons</h3>
            <p>Press <Kbd>Q</Kbd> or scroll the mouse wheel to cycle through your inventory. Picked-up weapons appear in the weapon bar at the bottom of the screen with their ammo count.</p>
        </div>
    );
}

function MechanicsSection() {
    return (
        <div className="help-section">
            <h3>Health & Armor</h3>
            <div className="help-key-grid">
                <div className="help-key-row">
                    <span className="help-key-combo">{'\u2764\u{FE0F}'} HP</span>
                    <span className="help-key-desc">2 base health points. Each gun hit removes 1 HP.</span>
                </div>
                <div className="help-key-row">
                    <span className="help-key-combo">{'\u{1F6E1}\u{FE0F}'} Armor</span>
                    <span className="help-key-desc">Adds +1 shield that absorbs the first hit.</span>
                </div>
            </div>

            <h3>Items</h3>
            <p>When item spawns are enabled, health packs, armor plates, and machine guns appear on the map periodically (every 60 seconds).</p>

            <h3>Shrinking Zone</h3>
            <p>When enabled, a danger zone slowly closes in. Players caught outside take damage. Stay inside the safe zone to survive!</p>

            <h3>Rounds</h3>
            <p>Matches can be best of 1, 3, or 5 rounds. The last player alive wins each round. Win the majority of rounds to win the match.</p>

            <h3>NPC Enemies</h3>
            <p>The host can add 0-3 AI-controlled enemies to fill out the match. NPCs behave like regular players.</p>
        </div>
    );
}

function CharactersSection() {
    return (
        <div className="help-section">
            <h3>Character Selection</h3>
            <ul className="help-list">
                <li>Choose your character before joining a match from the home screen.</li>
                <li>8 characters available: Student, Researcher, Professor, Dean, Librarian, Graduate, Lab Assistant, and Teaching Assistant.</li>
                <li>Each character can be played as male or female.</li>
            </ul>

            <h3>Unlocking Characters</h3>
            <ul className="help-list">
                <li>Some characters are locked and must be purchased with Respect.</li>
                <li>Locked characters show a cost of 500 Respect.</li>
                <li>Once purchased, a character is permanently unlocked on your account.</li>
            </ul>
        </div>
    );
}

function ProgressionSection() {
    return (
        <div className="help-section">
            <h3>Respect & XP</h3>
            <ul className="help-list">
                <li>Earn Respect and XP at the end of each match based on your performance.</li>
                <li>Respect is the currency used to unlock characters and cosmetics.</li>
                <li>XP contributes to your character level progression.</li>
            </ul>

            <h3>Leaderboard & Stats</h3>
            <ul className="help-list">
                <li>Track your kills, deaths, K/D ratio, and win rate on the leaderboard.</li>
                <li>Stats are updated after every match.</li>
                <li>Compete with other players for the top ranks.</li>
            </ul>

            <h3>Loadout</h3>
            <p>Access your loadout from the home screen to customize your character and view your unlocked items.</p>
        </div>
    );
}

function LobbySection() {
    return (
        <div className="help-section">
            <h3>Creating & Joining</h3>
            <ul className="help-list">
                <li>Click "Create Lobby" to start a new game. Share the 6-character code with friends.</li>
                <li>Enter a code and click "Join" to join an existing lobby.</li>
                <li>Browse open lobbies at the bottom of the home screen.</li>
            </ul>

            <h3>Host Settings</h3>
            <ul className="help-list">
                <li><strong>Arena</strong> - Choose from Campus Courtyard, Warehouse District, or Forest Clearing.</li>
                <li><strong>Map Size</strong> - 1x (small), 2x (medium), or 3x (large).</li>
                <li><strong>Best of</strong> - Number of rounds: 1, 3, or 5.</li>
                <li><strong>Shrinking Zone</strong> - Danger zone that closes in over time.</li>
                <li><strong>Item Spawns</strong> - Health, armor, and weapon pickups.</li>
                <li><strong>NPC Enemies</strong> - Add 0-3 AI opponents.</li>
            </ul>

            <h3>Starting a Match</h3>
            <p>All players must ready up (minimum 2 participants including NPCs). Only the host can start the game.</p>
        </div>
    );
}

function SpectatorSection() {
    return (
        <div className="help-section">
            <h3>Spectator Mode</h3>
            <ul className="help-list">
                <li>When you die, you automatically enter spectator mode.</li>
                <li>The camera follows a surviving player.</li>
                <li>A banner shows who you're spectating.</li>
                <li>Wait for the round to end to see the results.</li>
            </ul>
        </div>
    );
}

interface HelpScreenProps {
    isOpen: boolean;
    onClose: () => void;
}

export function HelpScreen({ isOpen, onClose }: HelpScreenProps) {
    const [activeSection, setActiveSection] = useState<HelpSection>('howToPlay');
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        modalRef.current?.focus();
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div className="help-overlay" onClick={handleOverlayClick}>
            <div
                className="help-modal"
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="help-screen-title"
                data-testid="help-dialog"
                tabIndex={-1}
            >
                <div className="help-header">
                    <h2 id="help-screen-title">Arena Guide</h2>
                    <button
                        className="help-close-btn"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        {'\u00D7'}
                    </button>
                </div>

                <div className="help-body">
                    <nav className="help-sidebar">
                        {SECTIONS.map(({ key, icon, label }) => (
                            <button
                                key={key}
                                className={`help-nav-item ${activeSection === key ? 'active' : ''}`}
                                onClick={() => setActiveSection(key)}
                                data-testid={`help-nav-${key}`}
                            >
                                <span className="help-nav-icon">{icon}</span>
                                <span className="help-nav-label">{label}</span>
                            </button>
                        ))}
                    </nav>

                    <div className="help-content" data-testid="help-content">
                        {activeSection === 'howToPlay' && <HowToPlaySection />}
                        {activeSection === 'controls' && <ControlsSection />}
                        {activeSection === 'weapons' && <WeaponsSection />}
                        {activeSection === 'mechanics' && <MechanicsSection />}
                        {activeSection === 'characters' && <CharactersSection />}
                        {activeSection === 'progression' && <ProgressionSection />}
                        {activeSection === 'lobby' && <LobbySection />}
                        {activeSection === 'spectator' && <SpectatorSection />}
                    </div>
                </div>
            </div>
        </div>
    );
}

interface HelpButtonProps {
    onClick: () => void;
}

export function HelpButton({ onClick }: HelpButtonProps) {
    return (
        <button
            className="help-fab"
            onClick={onClick}
            aria-label="Help"
            title="Help"
            data-testid="help-button"
        >
            ?
        </button>
    );
}
