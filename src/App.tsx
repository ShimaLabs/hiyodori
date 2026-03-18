import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './AppLayout';
import Home from './pages/Home';
import Import from './pages/Import';
import Library from './pages/Library';
import SessionSetup from './pages/SessionSetup';
import Practice from './pages/Practice';
import SessionResults from './pages/SessionResults';

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/import" element={<Import />} />
        <Route path="/library" element={<Library />} />
        <Route path="/session-setup" element={<SessionSetup />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/session-results" element={<SessionResults />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
