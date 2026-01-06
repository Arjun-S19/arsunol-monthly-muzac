import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = (env.VITE_SITE_BASE || '/').trim() || '/';

  return {
    base,
    plugins: [react()],
    assetsInclude: ['**/*.md'],
    build: {
      sourcemap: env.VITE_SOURCEMAP === 'true'
    }
  };
});
