import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY),
        'process.env.VITE_LLM_PROVIDER': JSON.stringify(env.VITE_LLM_PROVIDER || 'gemini'),
        'process.env.VITE_GEMINI_FLASH_MODEL': JSON.stringify(env.VITE_GEMINI_FLASH_MODEL || 'gemini-2.0-flash-exp'),
        'process.env.VITE_GEMINI_PRO_MODEL': JSON.stringify(env.VITE_GEMINI_PRO_MODEL || 'gemini-2.0-pro-exp-02-05'),
        'process.env.VITE_OLLAMA_BASE_URL': JSON.stringify(env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434'),
        'process.env.VITE_OLLAMA_MODEL': JSON.stringify(env.VITE_OLLAMA_MODEL || 'gemma4:31b-cloud'),
        'process.env.VITE_LM_STUDIO_BASE_URL': JSON.stringify(env.VITE_LM_STUDIO_BASE_URL || 'http://localhost:1234/v1'),
        'process.env.VITE_LM_STUDIO_MODEL': JSON.stringify(env.VITE_LM_STUDIO_MODEL || 'default'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
