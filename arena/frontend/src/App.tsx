import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Game from './components/Game';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/lobby/:code" element={<Lobby />} />
                <Route path="/game/:matchId" element={<Game />} />
            </Routes>
        </BrowserRouter>
    );
}
