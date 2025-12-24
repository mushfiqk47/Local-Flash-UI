import { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { AIProvider } from '../types';

const DEFAULT_MODELS = {
  gemini: 'gemini-3-flash-preview',
  openrouter: 'z-ai/glm-4.7',
  lmstudio: 'local-model',
  aiml: 'gpt-4o'
};

export function useAI() {
  const [provider, setProvider] = useState<AIProvider>(() => {
    const saved = localStorage.getItem('flash-ui-provider');
    return (saved === 'gemini' || saved === 'openrouter' || saved === 'lmstudio') ? saved : 'gemini';
  });

  const [modelId, setModelId] = useState<string>(() => {
    const saved = localStorage.getItem('flash-ui-model-id');
    return saved || DEFAULT_MODELS.openrouter;
  });



  const [useTailwind, setUseTailwind] = useState<boolean>(() => {
    return localStorage.getItem('flash-ui-use-tailwind') === 'true';
  });

  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<{ id: string, name?: string }[]>([]);

  useEffect(() => {
    localStorage.setItem('flash-ui-provider', provider);
    localStorage.setItem('flash-ui-model-id', modelId);
    localStorage.setItem('flash-ui-use-tailwind', String(useTailwind));
  }, [provider, modelId, useTailwind]);

  // --- Model Fetching ---
  const fetchModels = async () => {
    setModels([]);
    try {
      if (provider === 'lmstudio') {
        const baseUrl = process.env.LM_STUDIO_URL || 'http://localhost:1234';
        const res = await fetch(`${baseUrl}/v1/models`);
        if (res.ok) {
          const data = await res.json();
          if (data.data && Array.isArray(data.data)) {
            setModels(data.data.map((m: any) => ({ id: m.id, name: m.id })));
            // Auto-select first model if current ID is default or empty
            if (data.data.length > 0 && (modelId === DEFAULT_MODELS.lmstudio || !modelId)) {
              setModelId(data.data[0].id);
            }
          }
        }
      } else if (provider === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/models');
        if (res.ok) {
          const data = await res.json();
          if (data.data && Array.isArray(data.data)) {
            setModels(data.data.map((m: any) => ({ id: m.id, name: m.name || m.id })));
          }
        }
      } else if (provider === 'aiml') {
        const apiKey = process.env.AIML_API_KEY;
        if (!apiKey) return;

        const res = await fetch('https://api.aimlapi.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.data && Array.isArray(data.data)) {
            setModels(data.data.map((m: any) => ({ id: m.id, name: m.name || m.id })));
          }
        }
      }
    } catch (e) {
      console.warn("Failed to fetch models for", provider, e);
    }
  };

  useEffect(() => {
    fetchModels();
  }, [provider]);

  // --- API Helpers ---

  const streamOpenRouterCompletion = async function* (prompt: string, model: string, temperature: number) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured.");

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Flash UI',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        stream: true,
      })
    });

    if (!response.ok) {
      let errorMsg = response.statusText;
      try {
        const errorData = await response.json();
        if (errorData && errorData.error && errorData.error.message) {
          errorMsg = errorData.error.message;
        }
      } catch (e) {
        // Failed to parse error JSON, fall back to statusText
      }
      throw new Error(`OpenRouter API error: ${errorMsg}`);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield { text: content };
          } catch (e) { }
        }
      }
    }
  };

  const streamLMStudioCompletion = async function* (prompt: string, model: string, temperature: number) {
    const baseUrl = process.env.LM_STUDIO_URL || 'http://localhost:1234';
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        stream: true,
      })
    });

    if (!response.ok) throw new Error(`LM Studio error: ${response.statusText}. Ensure server is at ${baseUrl}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield { text: content };
          } catch (e) { }
        }
      }
    }
  };

  const streamAIMLCompletion = async function* (prompt: string, model: string, temperature: number) {
    const apiKey = process.env.AIML_API_KEY;
    if (!apiKey) throw new Error("AIML API Key is missing. Please configure AIML_API_KEY in your .env file.");

    const response = await fetch('https://api.aimlapi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        stream: true,
      })
    });

    if (!response.ok) {
      let errorMsg = response.statusText;
      try {
        const text = await response.text();
        console.error("AIML Raw Error Response:", text);
        const err = JSON.parse(text);
        if (err?.error?.message) errorMsg = err.error.message;
      } catch (e) {
        console.error("Failed to parse error JSON:", e);
      }
      throw new Error(`AIML API Error (${response.status}): ${errorMsg}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield { text: content };
          } catch (e) { }
        }
      }
    }
  };

  // --- Main Methods ---

  const streamContent = async function* (prompt: string, temperature: number = 0.9) {
    // Append Tailwind instruction if enabled
    let finalPrompt = prompt;
    if (useTailwind) {
      finalPrompt += "\n\nIMPORTANT: Use Tailwind CSS classes for styling instead of raw CSS in <style> tags. Assume Tailwind CDN is present.";
    }

    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY; // Correct env var name
      if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
      const ai = new GoogleGenAI({ apiKey });
      const responseStream = await ai.models.generateContentStream({
        model: DEFAULT_MODELS.gemini,
        contents: [{ parts: [{ text: finalPrompt }], role: 'user' }],
        config: { temperature }
      });
      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (typeof text === 'string') yield { text };
      }
    } else if (provider === 'openrouter') {
      for await (const chunk of streamOpenRouterCompletion(finalPrompt, modelId, temperature)) {
        yield chunk;
      }
    } else if (provider === 'lmstudio') {
      for await (const chunk of streamLMStudioCompletion(finalPrompt, modelId, temperature)) {
        yield chunk;
      }
    } else if (provider === 'aiml') {
      for await (const chunk of streamAIMLCompletion(finalPrompt, modelId, temperature)) {
        yield chunk;
      }
    }
  };

  const generateContent = async (prompt: string): Promise<string> => {
    // Append Tailwind instruction if enabled
    let finalPrompt = prompt;
    if (useTailwind) {
      finalPrompt += "\n\nIMPORTANT: Use Tailwind CSS classes for styling.";
    }

    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: DEFAULT_MODELS.gemini,
        contents: { role: 'user', parts: [{ text: finalPrompt }] }
      });
      return response.text || '[]';
    } else if (provider === 'openrouter') {
      let fullText = '';
      for await (const chunk of streamOpenRouterCompletion(finalPrompt, modelId, 0.9)) {
        fullText += chunk.text;
      }
      return fullText;
    } else if (provider === 'lmstudio') {
      let fullText = '';
      for await (const chunk of streamLMStudioCompletion(finalPrompt, modelId, 0.9)) {
        fullText += chunk.text;
      }
      return fullText;
    } else if (provider === 'aiml') {
      let fullText = '';
      for await (const chunk of streamAIMLCompletion(finalPrompt, modelId, 0.9)) {
        fullText += chunk.text;
      }
      return fullText;
    }
    return ''; // Fallback
  };

  const parseJsonStream = async function* (responseStream: AsyncGenerator<{ text: string }>) {
    let buffer = '';
    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (typeof text !== 'string') continue;
      buffer += text;

      while (true) {
        const start = buffer.indexOf('{');
        if (start === -1) break;

        let braceCount = 0;
        let inString = false;
        let escaped = false;
        let end = -1;

        for (let i = start; i < buffer.length; i++) {
          const char = buffer[i];
          if (!escaped && char === '"') inString = !inString;
          if (!inString) {
            if (char === '{') braceCount++;
            else if (char === '}') braceCount--;
          }
          if (char === '\\' && !escaped) escaped = true;
          else escaped = false;

          if (braceCount === 0 && i > start) {
            end = i;
            break;
          }
        }

        if (end !== -1) {
          const jsonString = buffer.substring(start, end + 1);
          try {
            yield JSON.parse(jsonString);
            buffer = buffer.substring(end + 1);
          } catch (e) {
            buffer = buffer.substring(start + 1);
          }
        } else {
          break;
        }
      }
    }
  };

  return {
    provider,
    setProvider,
    modelId,
    setModelId,
    useTailwind,
    setUseTailwind,
    isLoading,
    setIsLoading,
    streamContent,
    generateContent,
    parseJsonStream,
    models,
    refreshModels: fetchModels,

  };
}
