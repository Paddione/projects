import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Game from './components/Game';
import MatchResults from './components/MatchResults';
import Leaderboard from './components/Leaderboard';

export default function App() {
    return (
        <BrowserRouter>
            <AuthGuard>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/lobby/:code" element={<Lobby />} />
                    <Route path="/game/:matchId" element={<Game />} />
                    <Route path="/results/:matchId" element={<MatchResults />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                </Routes>
            </AuthGuard>
        </BrowserRouter>
    );
}
