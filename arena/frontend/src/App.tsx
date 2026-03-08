import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Game from './components/Game';

export default function App() {
    return (
        <BrowserRouter>
            <AuthGuard>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/lobby/:code" element={<Lobby />} />
                    <Route path="/game/:matchId" element={<Game />} />
                </Routes>
            </AuthGuard>
        </BrowserRouter>
    );
}
