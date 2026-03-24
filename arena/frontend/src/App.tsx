import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Game from './components/Game';
import Game3D from './components/Game3D';
import MatchResults from './components/MatchResults';
import Leaderboard from './components/Leaderboard';
import LoadoutScreen from './components/LoadoutScreen';
import PrivateMatch from './components/PrivateMatch';
import CampaignHome from './components/campaign/CampaignHome';
import CampaignPlay from './components/campaign/CampaignPlay';
import { HelpButton, HelpScreen } from './components/HelpScreen';
import { useGameStore } from './stores/gameStore';

function GameRoute() {
    const use3DRenderer = useGameStore((s) => s.use3DRenderer);
    return use3DRenderer ? <Game3D /> : <Game />;
}

export default function App() {
    const [helpOpen, setHelpOpen] = useState(false);

    return (
        <BrowserRouter>
            <AuthGuard>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/lobby/:code" element={<Lobby />} />
                    <Route path="/game/:matchId" element={<GameRoute />} />
                    <Route path="/results/:matchId" element={<MatchResults />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                    <Route path="/loadout" element={<LoadoutScreen />} />
                    <Route path="/match/:token" element={<PrivateMatch />} />
                    <Route path="/campaign" element={<CampaignHome />} />
                    <Route path="/campaign/play/:sessionId" element={<CampaignPlay />} />
                </Routes>
                <HelpButton onClick={() => setHelpOpen(true)} />
                <HelpScreen isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
            </AuthGuard>
        </BrowserRouter>
    );
}
