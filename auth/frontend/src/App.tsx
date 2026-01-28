import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Hub from './pages/Hub';
import Admin from './pages/Admin';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<Login />} />
        <Route path="/verify-email" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/hub" element={<Hub />} />
        <Route path="/apps" element={<Navigate to="/hub" replace />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
