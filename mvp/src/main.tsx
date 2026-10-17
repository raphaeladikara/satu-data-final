import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Practice from './pages/Practice';
import Cases from './pages/Cases';
import Dashboard from './pages/Dashboard';
import './styles.css';

// tanpa StrictMode: Cornerstone3D memegang konteks WebGL yang tidak boleh dibuat dua kali
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/latihan" element={<Practice />} />
      <Route path="/kasus" element={<Cases />} />
      <Route path="/dosen" element={<Dashboard />} />
    </Routes>
  </BrowserRouter>,
);
