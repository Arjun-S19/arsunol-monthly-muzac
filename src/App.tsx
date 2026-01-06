import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Background from './components/Background';
import HomePage from './pages/Home';
import PostPage from './pages/Post';

export default function App() {
  const rawBase = import.meta.env.BASE_URL || '/';
  const normalized = rawBase === './' ? '' : rawBase.replace(/\/$/, '');

  return (
    <BrowserRouter basename={normalized || undefined}>
      <Background />
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/blog/:slug" element={<PostPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
