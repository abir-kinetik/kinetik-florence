import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.TS_DEV_API_URL': JSON.stringify(env.TS_DEV_API_URL),
      'process.env.TS_SERVICE_TOKEN_KEY': JSON.stringify(env.TS_SERVICE_TOKEN_KEY),
      'process.env.TS_SERVICE_TOKEN_SECRET': JSON.stringify(env.TS_SERVICE_TOKEN_SECRET),
      'process.env.EMAIL_SERVICE_ID': JSON.stringify(env.EMAIL_SERVICE_ID),
      'process.env.EMAIL_TEMPLATE_ID': JSON.stringify(env.EMAIL_TEMPLATE_ID),
      'process.env.EMAIL_PUBLIC_KEY': JSON.stringify(env.EMAIL_PUBLIC_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
