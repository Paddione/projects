import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Game from './components/Game';
import MatchResults from './components/MatchResults';
import Leaderboard from './components/Leaderboard';
import LoadoutScreen from './components/LoadoutScreen';
import { HelpButton, HelpScreen } from './components/HelpScreen';

export default function App() {
    const [helpOpen, setHelpOpen] = useState(false);

    return (
        <BrowserRouter>
            <AuthGuard>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/lobby/:code" element={<Lobby />} />
                    <Route path="/game/:matchId" element={<Game />} />
                    <Route path="/results/:matchId" element={<MatchResults />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                    <Route path="/loadout" element={<LoadoutScreen />} />
                </Routes>
                <HelpButton onClick={() => setHelpOpen(true)} />
                <HelpScreen isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
            </AuthGuard>
        </BrowserRouter>
    );
}
