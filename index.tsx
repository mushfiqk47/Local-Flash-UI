
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

//Vibe coded by ammaar@google.com

import { GoogleGenAI } from '@google/genai';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import { Artifact, Session, ComponentVariation, LayoutOption, Skill } from './types';
import { INITIAL_PLACEHOLDERS } from './constants';
import { generateId, extractBase64, parseJsonStream, sanitizeFilename } from './utils';

import DottedGlowBackground from './components/DottedGlowBackground';
import ArtifactCard from './components/ArtifactCard';
import SideDrawer from './components/SideDrawer';
import PromptInput from './components/PromptInput';
import ActionBar from './components/ActionBar';
import ThemeToggle from './components/ThemeToggle';
import SkillsManager from './components/SkillsManager';
import { ToastContainer, useToast } from './components/Toast';

import { 
    ThinkingIcon, 
    SparklesIcon, 
    ArrowLeftIcon, 
    ArrowRightIcon, 
    DownloadIcon,
    TrashIcon,
    ZapIcon,
    DiamondIcon,
    MagicWandIcon,
    BrainIcon
} from './components/Icons';

// --- Custom Undo/Redo Hook ---
function useUndoableState<T>(initialState: T) {
    const [past, setPast] = useState<T[]>([]);
    const [present, setPresent] = useState<T>(initialState);
    const [future, setFuture] = useState<T[]>([]);

    const set = useCallback((newState: T | ((prev: T) => T), addToHistory = true) => {
        setPresent((curr) => {
            const next = typeof newState === 'function' ? (newState as Function)(curr) : newState;
            if (addToHistory) {
                setPast((p) => [...p, curr]);
                setFuture([]);
            }
            return next;
        });
    }, []);

    const undo = useCallback(() => {
        setPast((p) => {
            if (p.length === 0) return p;
            const newPresent = p[p.length - 1];
            const newPast = p.slice(0, p.length - 1);
            setPresent(curr => {
                setFuture(f => [curr, ...f]);
                return newPresent;
            });
            return newPast;
        });
    }, []);

    const redo = useCallback(() => {
        setFuture((f) => {
            if (f.length === 0) return f;
            const newPresent = f[0];
            const newFuture = f.slice(1);
            setPresent(curr => {
                setPast(p => [...p, curr]);
                return newPresent;
            });
            return newFuture;
        });
    }, []);

    return { 
        state: present, 
        setState: set, 
        undo, 
        redo, 
        canUndo: past.length > 0, 
        canRedo: future.length > 0 
    };
}

type LLMProviderId = 'gemini-flash' | 'gemini-pro' | 'ollama' | 'lm-studio';

const LLM_PROVIDERS: { id: LLMProviderId; label: string; icon: string }[] = [
    { id: 'gemini-flash', label: 'Flash', icon: 'zap' },
    { id: 'gemini-pro', label: 'Pro', icon: 'diamond' },
    { id: 'ollama', label: 'Ollama', icon: 'brain' },
    { id: 'lm-studio', label: 'LM Studio', icon: 'brain' },
];

function getDefaultProvider(): LLMProviderId {
    const fromEnv = (process.env.VITE_LLM_PROVIDER || 'gemini') as string;
    if (fromEnv === 'ollama') return 'ollama';
    if (fromEnv === 'lm-studio') return 'lm-studio';
    return 'gemini-flash';
}

function buildSystemPrompt(activeSkillsContext: string): string {
    if (!activeSkillsContext) return '';
    return `You are a master UI/UX designer and developer. You have the following specialized skills that MUST guide EVERY design decision you make:\n\n${activeSkillsContext}\n\nApply these skills to all responses.`;
}

async function* streamOllama(prompt: string, systemPrompt?: string) {
    const baseUrl = process.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434';
    const model = process.env.VITE_OLLAMA_MODEL || 'gemma4:31b-cloud';
    const body: any = { model, prompt, stream: true };
    if (systemPrompt) body.system = systemPrompt;
    const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader found on response body");
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const json = JSON.parse(line);
                if (json.response) yield { text: json.response };
            } catch (e) {}
        }
    }
}

async function streamGemini(prompt: string, model: string, systemPrompt?: string, image?: string) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) throw new Error("Gemini API key not configured. Set VITE_GEMINI_API_KEY in .env");
    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [{ text: prompt }];
    if (image) {
        const imgData = extractBase64(image);
        if (imgData) parts.push({ inlineData: imgData });
    }
    const contents = [{ role: 'user', parts }];
    const request: any = { model, contents };
    if (systemPrompt) request.systemInstruction = { role: 'user', parts: [{ text: systemPrompt }] };
    return ai.models.generateContentStream(request);
}

async function* streamLMStudio(prompt: string, systemPrompt?: string) {
    const baseUrl = process.env.VITE_LM_STUDIO_BASE_URL || 'http://localhost:1234/v1';
    const model = process.env.VITE_LM_STUDIO_MODEL || 'default';
    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: true })
    });
    if (!response.ok) throw new Error(`LM Studio error: ${response.statusText}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader found on response body");
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
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') break;
            try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content || '';
                if (content) yield { text: content };
            } catch (e) {}
        }
    }
}

async function getOllama(prompt: string, systemPrompt?: string) {
    const baseUrl = process.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434';
    const model = process.env.VITE_OLLAMA_MODEL || 'gemma4:31b-cloud';
    const body: any = { model, prompt, stream: false };
    if (systemPrompt) body.system = systemPrompt;
    const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
    const json = await response.json();
    return { text: json.response };
}

async function getGemini(prompt: string, model: string, systemPrompt?: string, image?: string) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) throw new Error("Gemini API key not configured. Set VITE_GEMINI_API_KEY in .env");
    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [{ text: prompt }];
    if (image) {
        const imgData = extractBase64(image);
        if (imgData) parts.push({ inlineData: imgData });
    }
    const contents = { role: 'user', parts };
    const request: any = { model, contents };
    if (systemPrompt) request.systemInstruction = { role: 'user', parts: [{ text: systemPrompt }] };
    const result = await ai.models.generateContent(request);
    return { text: result.text };
}

async function getLMStudio(prompt: string, systemPrompt?: string) {
    const baseUrl = process.env.VITE_LM_STUDIO_BASE_URL || 'http://localhost:1234/v1';
    const model = process.env.VITE_LM_STUDIO_MODEL || 'default';
    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });
    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: false })
    });
    if (!response.ok) throw new Error(`LM Studio error: ${response.statusText}`);
    const json = await response.json();
    return { text: json.choices?.[0]?.message?.content || '' };
}

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
      return (localStorage.getItem('flash-ui-theme') as 'dark' | 'light') || 'dark';
  });
  const [activeProvider, setActiveProvider] = useState<LLMProviderId>(() => {
      const saved = localStorage.getItem('flash-ui-provider') as LLMProviderId | null;
      if (saved && LLM_PROVIDERS.some(p => p.id === saved)) return saved;
      return getDefaultProvider();
  });
  const { toasts, addToast, dismissToast } = useToast();
  const [variantCount, setVariantCount] = useState<number>(3);

  const cycleVariantCount = () => {
      setVariantCount(prev => prev >= 3 ? 1 : prev + 1);
  };

  const getResponseStream = useCallback(async (prompt: string, image?: string) => {
    if (activeProvider === 'ollama') return streamOllama(prompt, systemPrompt);
    if (activeProvider === 'lm-studio') return streamLMStudio(prompt, systemPrompt);
    const geminiModel = activeProvider === 'gemini-pro'
        ? (process.env.VITE_GEMINI_PRO_MODEL || 'gemini-2.0-pro-exp-02-05')
        : (process.env.VITE_GEMINI_FLASH_MODEL || 'gemini-2.0-flash-exp');
    return streamGemini(prompt, geminiModel, systemPrompt, image);
  }, [activeProvider, systemPrompt]);

  const getResponse = useCallback(async (prompt: string, image?: string) => {
    if (activeProvider === 'ollama') return getOllama(prompt, systemPrompt);
    if (activeProvider === 'lm-studio') return getLMStudio(prompt, systemPrompt);
    const geminiModel = activeProvider === 'gemini-pro'
        ? (process.env.VITE_GEMINI_PRO_MODEL || 'gemini-2.0-pro-exp-02-05')
        : (process.env.VITE_GEMINI_FLASH_MODEL || 'gemini-2.0-flash-exp');
    return getGemini(prompt, geminiModel, systemPrompt, image);
  }, [activeProvider, systemPrompt]);

  const { 
      state: sessions, 
      setState: setSessions, 
      undo, 
      redo, 
      canUndo, 
      canRedo 
  } = useUndoableState<Session[]>([]);

  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(-1);
  const [focusedArtifactIndex, setFocusedArtifactIndex] = useState<number | null>(null);
  
  const [inputValue, setInputValue] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholders, setPlaceholders] = useState<string[]>(INITIAL_PLACEHOLDERS);
  
  const [drawerState, setDrawerState] = useState<{
      isOpen: boolean;
      mode: 'code' | 'variations' | 'full-page' | 'history' | 'skills' | null;
      title: string;
      data: any; 
  }>({ isOpen: false, mode: null, title: '', data: null });

  const [skills, setSkills] = useState<Skill[]>(() => {
      try {
          const saved = localStorage.getItem('flash-ui-skills');
          if (saved) return JSON.parse(saved);
      } catch(e) {}
      return [];
  });

  useEffect(() => {
      localStorage.setItem('flash-ui-skills', JSON.stringify(skills));
  }, [skills]);

  const activeSkillsContext = skills.filter(s => s.isActive).map(s => `[Skill: ${s.name}]\n${s.description}`).join('\n\n');
  const systemPrompt = buildSystemPrompt(activeSkillsContext);

  const [componentVariations, setComponentVariations] = useState<ComponentVariation[]>([]);
  const [isImproving, setIsImproving] = useState<boolean>(false);

  // --- Full Page Improvement State ---
  const [fullPageInputValue, setFullPageInputValue] = useState('');
  const [isFullPageImproving, setIsFullPageImproving] = useState(false);

  const gridScrollRef = useRef<HTMLDivElement>(null);

  // Update theme on document
  useEffect(() => {
      document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
      setTheme(prev => {
          const next = prev === 'dark' ? 'light' : 'dark';
          localStorage.setItem('flash-ui-theme', next);
          return next;
      });
  };

  const toggleModel = () => {
      setActiveProvider(prev => {
          const idx = LLM_PROVIDERS.findIndex(p => p.id === prev);
          const next = LLM_PROVIDERS[(idx + 1) % LLM_PROVIDERS.length].id;
          localStorage.setItem('flash-ui-provider', next);
          return next;
      });
  };

  // Fix for mobile: reset scroll when focusing an item to prevent "overscroll" state
  useEffect(() => {
    if (focusedArtifactIndex !== null && window.innerWidth <= 1024) {
        if (gridScrollRef.current) {
            gridScrollRef.current.scrollTop = 0;
        }
        window.scrollTo(0, 0);
    }
  }, [focusedArtifactIndex]);

  // Cycle placeholders
  useEffect(() => {
      const interval = setInterval(() => {
          setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
      }, 3000);
      return () => clearInterval(interval);
  }, [placeholders.length]);

  // Dynamic placeholder generation on load
  useEffect(() => {
      const fetchDynamicPlaceholders = async () => {
          try {
              const apiKey = process.env.API_KEY;
              if (!apiKey) return;
              const ai = new GoogleGenAI({ apiKey });
              const response = await ai.models.generateContent({
                  model: 'gemini-3.1-pro-preview',
                  contents: { 
                      role: 'user', 
                      parts: [{ 
                          text: 'Generate 20 creative, short, diverse UI component prompts (e.g. "bioluminescent task list"). Return ONLY a raw JSON array of strings. IP SAFEGUARD: Avoid referencing specific famous artists, movies, or brands.' 
                      }] 
                  }
              });
              const text = response.text || '[]';
              const jsonMatch = text.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                  const newPlaceholders = JSON.parse(jsonMatch[0]);
                  if (Array.isArray(newPlaceholders) && newPlaceholders.length > 0) {
                      const shuffled = newPlaceholders.sort(() => 0.5 - Math.random()).slice(0, 10);
                      setPlaceholders(prev => [...prev, ...shuffled]);
                  }
              }
          } catch (e) {
              console.warn("Silently failed to fetch dynamic placeholders", e);
          }
      };
      setTimeout(fetchDynamicPlaceholders, 1000);
  }, []);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setSelectedImage(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
      // Reset input value to allow re-uploading same file if needed
      event.target.value = '';
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedImage(null);
  };

  // --- New Duplicate Function ---
  const handleDuplicateArtifact = useCallback(() => {
      if (currentSessionIndex === -1 || focusedArtifactIndex === null) return;
      const session = sessions[currentSessionIndex];
      const artifact = session.artifacts[focusedArtifactIndex];
      
      const newArtifact: Artifact = {
          ...artifact,
          id: generateId(),
          styleName: `${artifact.styleName} (Copy)`,
      };

      setSessions(prev => prev.map((s, i) => 
          i === currentSessionIndex 
          ? { ...s, artifacts: [...s.artifacts, newArtifact] }
          : s
      ), true);
      addToast('Design duplicated', 'success');
  }, [sessions, currentSessionIndex, focusedArtifactIndex, setSessions, addToast]);

  // --- New Improve Mode Function ---
  const handleEnterImproveMode = useCallback(() => {
      if (focusedArtifactIndex === null) return;
      setIsImproving(true);
      setInputValue('');
  }, [focusedArtifactIndex]);

  const handleCancelImprove = useCallback(() => {
      setIsImproving(false);
      setInputValue('');
  }, []);

  const handleGenerateVariations = useCallback(async () => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || focusedArtifactIndex === null) return;
    const currentArtifact = currentSession.artifacts[focusedArtifactIndex];

    setIsLoading(true);
    setComponentVariations([]);
    setDrawerState({ isOpen: true, mode: 'variations', title: 'Variations', data: currentArtifact.id });
    setFullPageInputValue('');
    setIsFullPageImproving(false);

    try {
        const prompt = `
Generate ${variantCount} RADICAL CONCEPTUAL VARIATIONS of: "${currentSession.prompt}".

**STRICT IP SAFEGUARD:**
No names of artists. 
Instead, describe the *Physicality* and *Material Logic* of the UI.

**CREATIVE GUIDANCE (Use these as EXAMPLES of how to describe style, but INVENT YOUR OWN):**
1. Example: "Asymmetrical Primary Grid" (Heavy black strokes, rectilinear structure, flat primary pigments, high-contrast white space).
2. Example: "Suspended Kinetic Mobile" (Delicate wire-thin connections, floating organic primary shapes, slow-motion balance, white-void background).
3. Example: "Grainy Risograph Press" (Overprinted translucent inks, dithered grain textures, monochromatic color depth, raw paper substrate).
4. Example: "Volumetric Spectral Fluid" (Generative morphing gradients, soft-focus diffusion, bioluminescent light sources, spectral chromatic aberration).

**YOUR TASK:**
For EACH variation:
- Invent a unique design persona name based on a NEW physical metaphor.
- Rewrite the prompt to fully adopt that metaphor's visual language.
- Generate high-fidelity HTML/CSS.

Required JSON Output Format (stream ONE object per line):
\`{ "name": "Persona Name", "html": "..." }\`
        `.trim();

        const responseStream = await getResponseStream(prompt);

        for await (const variation of parseJsonStream(responseStream)) {
            if (variation.name && variation.html) {
                setComponentVariations(prev => [...prev, variation]);
            }
        }
    } catch (e: any) {
        console.error("Error generating variations:", e);
        addToast(e.message || 'Failed to generate variations', 'error');
    } finally {
        setIsLoading(false);
    }
  }, [sessions, currentSessionIndex, focusedArtifactIndex, getResponseStream, variantCount]);

  const handleGenerateFullPage = useCallback(async () => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || focusedArtifactIndex === null) return;
    const currentArtifact = currentSession.artifacts[focusedArtifactIndex];

    setIsLoading(true);
    // Initialize drawer with empty string while loading
    setDrawerState({ isOpen: true, mode: 'full-page', title: 'Full Homepage', data: '' });
    // Reset full page improvement state
    setFullPageInputValue('');
    setIsFullPageImproving(false);

    try {
        const prompt = `
Take a specific UI component and expand it into a COMPLETE, SCROLLABLE HOMEPAGE.

**User Prompt:** "${currentSession.prompt}"
**Style Name:** "${currentArtifact.styleName}"
**Reference Component HTML:**
${currentArtifact.html}

**INSTRUCTIONS:**
1. **Analyze the Reference:** Extract the color palette, typography, border-radius, shadows, and "physical" metaphor (e.g. glassmorphism, brutalism, paper) from the Reference HTML.
2. **Build a Landing Page:** Create a comprehensive homepage (Hero, Features, Testimonials, Footer) that perfectly matches this aesthetic.
3. **Responsive:** Ensure it works on mobile and desktop.
4. **Hero Section:** Use the Reference Component HTML as the centerpiece or main visual in the Hero section, but feel free to enhance its layout.
5. **Content:** Write catchy, professional copy relevant to the User Prompt.

**OUTPUT:**
Return ONLY raw, valid HTML (with embedded CSS in <style> tags). 
Do NOT wrap in markdown code blocks.
        `.trim();

        const responseStream = await getResponseStream(prompt);

        let accumulatedHtml = '';
        for await (const chunk of responseStream) {
            const text = chunk.text;
            if (typeof text === 'string') {
                accumulatedHtml += text;
                // Clean up markdown if present during streaming
                let displayHtml = accumulatedHtml;
                if (displayHtml.startsWith('```html')) displayHtml = displayHtml.substring(7);
                if (displayHtml.startsWith('```')) displayHtml = displayHtml.substring(3);
                
                setDrawerState(prev => ({
                    ...prev,
                    data: displayHtml
                }));
            }
        }

        let finalHtml = accumulatedHtml.trim();
        if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
        if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
        if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();

        setDrawerState(prev => ({ ...prev, data: finalHtml }));

    } catch (e: any) {
        console.error("Error generating full page:", e);
        addToast(e.message || 'Failed to generate full page', 'error');
        setDrawerState(prev => ({ ...prev, data: `<div style="padding:20px;color:red">Error: ${e.message}</div>` }));
    } finally {
        setIsLoading(false);
    }
  }, [sessions, currentSessionIndex, focusedArtifactIndex, getResponseStream]);

  const handleImproveFullPage = useCallback(async () => {
    const currentHtml = drawerState.data;
    const promptText = fullPageInputValue.trim();
    if (!currentHtml || !promptText) return;

    setIsLoading(true);
    setFullPageInputValue(''); // Clear input for better ux

    try {
        const prompt = `
Improve the following HTML page based on the User Request.

**User Request:** "${promptText}"

**Current HTML:**
${currentHtml}

**Rules:**
1. Return the COMPLETE updated HTML.
2. Maintain the existing style unless asked to change.
3. Return ONLY raw HTML.
        `.trim();

        const responseStream = await getResponseStream(prompt);

        let accumulatedHtml = '';
        for await (const chunk of responseStream) {
            const text = chunk.text;
            if (typeof text === 'string') {
                accumulatedHtml += text;
                let displayHtml = accumulatedHtml;
                if (displayHtml.startsWith('```html')) displayHtml = displayHtml.substring(7);
                if (displayHtml.startsWith('```')) displayHtml = displayHtml.substring(3);

                setDrawerState(prev => ({
                    ...prev,
                    data: displayHtml
                }));
            }
        }
        
        let finalHtml = accumulatedHtml.trim();
        if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
        if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
        if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();
        
        setDrawerState(prev => ({ ...prev, data: finalHtml }));

    } catch (e: any) {
        console.error("Full page improvement failed:", e);
        addToast(e.message || 'Full page improvement failed', 'error');
    } finally {
        setIsLoading(false);
    }
  }, [drawerState.data, fullPageInputValue, getResponseStream]);

  const handleDownload = useCallback(async (contentToDownload?: string, filenamePrefix?: string) => {
    let htmlContent = contentToDownload;
    let filename = 'flash-ui-export';
    const currentSession = sessions[currentSessionIndex];

    const promptSlug = currentSession ? sanitizeFilename(currentSession.prompt) : 'design';

    if (!htmlContent) {
        // Default to focused artifact if no content passed
        if (!currentSession || focusedArtifactIndex === null) return;
        const artifact = currentSession.artifacts[focusedArtifactIndex];
        htmlContent = artifact.html;
        const styleSlug = sanitizeFilename(artifact.styleName);
        filename = `flash-ui-${promptSlug}-${styleSlug}`;
    } else {
        // Content passed manually (e.g. homepage)
        // If a prefix is provided (like 'flash-ui-homepage'), append prompt slug
        const prefix = filenamePrefix || 'flash-ui-export';
        filename = `${prefix}-${promptSlug}`;
    }

    try {
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast(`Downloaded ${filename}.html`, 'success');
    } catch (e) {
        console.error("Download failed", e);
        addToast('Download failed', 'error');
    }
  }, [sessions, currentSessionIndex, focusedArtifactIndex, addToast]);

  const applyVariation = (html: string) => {
      if (focusedArtifactIndex === null) return;
      setSessions(prev => prev.map((sess, i) => 
          i === currentSessionIndex ? {
              ...sess,
              artifacts: sess.artifacts.map((art, j) => 
                j === focusedArtifactIndex ? { ...art, html, status: 'complete' } : art
              )
          } : sess
      ), true);
      setDrawerState(s => ({ ...s, isOpen: false }));
      addToast('Variation applied', 'success');
  };

  const handleShowCode = () => {
      const currentSession = sessions[currentSessionIndex];
      if (currentSession && focusedArtifactIndex !== null) {
          const artifact = currentSession.artifacts[focusedArtifactIndex];
          setDrawerState({ isOpen: true, mode: 'code', title: 'Source Code', data: artifact.html });
      }
  };

  const handleShowHistory = () => {
      setDrawerState({ isOpen: true, mode: 'history', title: 'History', data: null });
  };

  const handleRestoreSession = (index: number) => {
      setCurrentSessionIndex(index);
      setFocusedArtifactIndex(null);
      setDrawerState(s => ({ ...s, isOpen: false }));
  };

  const handleDeleteSession = (index: number, e: React.MouseEvent) => {
      e.stopPropagation();
      setSessions(prev => {
          const newSessions = prev.filter((_, i) => i !== index);
          return newSessions;
      }, true); 
      
      if (index === currentSessionIndex) {
          setCurrentSessionIndex(Math.max(0, index - 1));
      } else if (index < currentSessionIndex) {
          setCurrentSessionIndex(currentSessionIndex - 1);
      }
  };

  const handleClearHistory = () => {
      if (window.confirm("Are you sure you want to clear all history?")) {
          setSessions([], true);
          setCurrentSessionIndex(-1);
      }
  };

  const handleSendMessage = useCallback(async (manualPrompt?: string) => {
    const promptToUse = manualPrompt || inputValue;
    const trimmedInput = promptToUse.trim();
    
    // Allow sending if image exists even if text is empty
    if ((!trimmedInput && !selectedImage) || isLoading) return;

    // --- IMPROVE MODE LOGIC ---
    if (isImproving && focusedArtifactIndex !== null && currentSessionIndex !== -1) {
        setIsLoading(true);
        const currentSession = sessions[currentSessionIndex];
        const artifactToImprove = currentSession.artifacts[focusedArtifactIndex];
        setInputValue('');
        setIsImproving(false); // Exit improve mode immediately
        
        try {
            const improvementPrompt = `
Improve the existing HTML/CSS component based on the user's request.

**User Request:** "${trimmedInput}"

**Current HTML:**
${artifactToImprove.html}

**Rules:**
1. Keep the overall aesthetic and style (${artifactToImprove.styleName}) unless explicitly asked to change it.
2. Fix bugs, change colors, adjust layout, or add features as requested.
3. Return ONLY the raw valid HTML. No markdown.
            `.trim();

            const responseStream = await getResponseStream(improvementPrompt);

            // Update artifact state in-place (with history)
            let accumulatedHtml = '';
            // First push a history state so we can undo
            setSessions(prev => prev, true);

            for await (const chunk of responseStream) {
                const text = chunk.text;
                if (typeof text === 'string') {
                    accumulatedHtml += text;
                    setSessions(prev => prev.map((s, i) => 
                        i === currentSessionIndex ? {
                            ...s,
                            artifacts: s.artifacts.map((art, j) => 
                                j === focusedArtifactIndex ? { ...art, html: accumulatedHtml, status: 'streaming' } : art
                            )
                        } : s
                    ), false);
                }
            }
            
            let finalHtml = accumulatedHtml.trim();
            if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
            if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
            if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();

            setSessions(prev => prev.map((s, i) => 
                i === currentSessionIndex ? {
                    ...s,
                    artifacts: s.artifacts.map((art, j) => 
                        j === focusedArtifactIndex ? { ...art, html: finalHtml, status: 'complete' } : art
                    )
                } : s
            ), false);

        } catch (e: any) {
            console.error("Improvement failed", e);
            addToast(e.message || 'Improvement failed', 'error');
        } finally {
            setIsLoading(false);
        }
        return;
    }
    
    // --- STANDARD GENERATION LOGIC ---
    if (!manualPrompt) setInputValue('');
    
    setIsLoading(true);
    const baseTime = Date.now();
    const sessionId = generateId();

    const placeholderArtifacts: Artifact[] = Array(variantCount).fill(null).map((_, i) => ({
        id: `${sessionId}_${i}`,
        styleName: 'Designing...',
        html: '',
        status: 'streaming',
    }));

    // If no text but image exists, provide a generic prompt for display
    const displayPrompt = trimmedInput || "this uploaded design";

    const newSession: Session = {
        id: sessionId,
        prompt: displayPrompt,
        timestamp: baseTime,
        artifacts: placeholderArtifacts
    };

    // Add new session to history stack
    setSessions(prev => [...prev, newSession], true);
    setCurrentSessionIndex(sessions.length); 
    setFocusedArtifactIndex(null); 
    
    const generationImage = selectedImage;
    if (!manualPrompt) setSelectedImage(null);

    try {
        const stylePrompt = `
Generate ${variantCount} distinct, highly evocative design directions for: "${displayPrompt}".
Return ONLY a raw JSON array of ${variantCount} *NEW*, creative names (e.g. ["Tactile Risograph Press"]).
        `.trim();

        const styleResponse = await getResponse(stylePrompt, generationImage);

        let generatedStyles: string[] = [];
        const styleText = styleResponse.text || '[]';
        const jsonMatch = styleText.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
            try {
                generatedStyles = JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.warn("Failed to parse styles, using fallbacks");
            }
        }

        if (!generatedStyles || generatedStyles.length < variantCount) {
            generatedStyles = [
                "Primary Pigment Gridwork",
                "Tactile Risograph Layering",
                "Kinetic Silhouette Balance"
            ];
        }
        
        generatedStyles = generatedStyles.slice(0, variantCount);

        // Update style names quietly
        setSessions(prev => prev.map(s => {
            if (s.id !== sessionId) return s;
            return {
                ...s,
                artifacts: s.artifacts.map((art, i) => ({
                    ...art,
                    styleName: generatedStyles[i]
                }))
            };
        }), false);

        const generateArtifact = async (artifact: Artifact, styleInstruction: string) => {
            try {
                const prompt = `
Create a stunning, high-fidelity UI component for: "${displayPrompt}".

**CONCEPTUAL DIRECTION: ${styleInstruction}**

**VISUAL EXECUTION RULES:**
1. **Materiality**: Use the specified metaphor to drive every CSS choice. (e.g. if Risograph, use \`feTurbulence\` for grain and \`mix-blend-mode: multiply\` for ink layering).
2. **Typography**: Use high-quality web fonts. Pair a bold sans-serif with a refined monospace for data.
3. **Motion**: Include subtle, high-performance CSS/JS animations (hover transitions, entry reveals).
4. **IP SAFEGUARD**: No artist names or trademarks. 
5. **Layout**: Be bold with negative space and hierarchy. Avoid generic cards.

Return ONLY RAW HTML. No markdown fences.
          `.trim();

                const responseStream = await getResponseStream(prompt, generationImage);

                let accumulatedHtml = '';
                for await (const chunk of responseStream) {
                    const text = chunk.text;
                    if (typeof text === 'string') {
                        accumulatedHtml += text;
                        // Streaming updates are quiet (not added to history stack)
                        setSessions(prev => prev.map(sess => 
                            sess.id === sessionId ? {
                                ...sess,
                                artifacts: sess.artifacts.map(art => 
                                    art.id === artifact.id ? { ...art, html: accumulatedHtml } : art
                                )
                            } : sess
                        ), false);
                    }
                }
                
                let finalHtml = accumulatedHtml.trim();
                if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
                if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
                if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();

                // Final update quiet
                setSessions(prev => prev.map(sess => 
                    sess.id === sessionId ? {
                        ...sess,
                        artifacts: sess.artifacts.map(art => 
                            art.id === artifact.id ? { ...art, html: finalHtml, status: finalHtml ? 'complete' : 'error' } : art
                        )
                    } : sess
                ), false);

            } catch (e: any) {
                console.error('Error generating artifact:', e);
                setSessions(prev => prev.map(sess => 
                    sess.id === sessionId ? {
                        ...sess,
                        artifacts: sess.artifacts.map(art => 
                            art.id === artifact.id ? { ...art, html: `<div style="color: #ff6b6b; padding: 20px;">Error: ${e.message}</div>`, status: 'error' } : art
                        )
                    } : sess
                ), false);
            }
        };

        await Promise.all(placeholderArtifacts.map((art, i) => generateArtifact(art, generatedStyles[i])));

    } catch (e: any) {
        console.error("Fatal error in generation process", e);
        addToast(e.message || 'Generation failed', 'error');
    } finally {
        setIsLoading(false);
    }
  }, [inputValue, selectedImage, isLoading, sessions.length, setSessions, getResponseStream, getResponse, isImproving, currentSessionIndex, focusedArtifactIndex, sessions, variantCount]);

  const handleSurpriseMe = () => {
      const currentPrompt = placeholders[placeholderIndex];
      setInputValue(currentPrompt);
      handleSendMessage(currentPrompt);
  };

  const nextItem = useCallback(() => {
      if (focusedArtifactIndex !== null) {
          if (focusedArtifactIndex < 2) setFocusedArtifactIndex(focusedArtifactIndex + 1);
      } else {
          if (currentSessionIndex < sessions.length - 1) setCurrentSessionIndex(currentSessionIndex + 1);
      }
  }, [currentSessionIndex, sessions.length, focusedArtifactIndex]);

  const prevItem = useCallback(() => {
      if (focusedArtifactIndex !== null) {
          if (focusedArtifactIndex > 0) setFocusedArtifactIndex(focusedArtifactIndex - 1);
      } else {
           if (currentSessionIndex > 0) setCurrentSessionIndex(currentSessionIndex - 1);
      }
  }, [currentSessionIndex, focusedArtifactIndex]);

  const isLoadingDrawer = isLoading && (
      (drawerState.mode === 'variations' && componentVariations.length === 0) ||
      (drawerState.mode === 'full-page' && !drawerState.data)
  );

  const hasStarted = sessions.length > 0 || isLoading;
  const currentSession = sessions[currentSessionIndex];

  let canGoBack = false;
  let canGoForward = false;

  if (hasStarted) {
      if (focusedArtifactIndex !== null) {
          canGoBack = focusedArtifactIndex > 0;
          canGoForward = focusedArtifactIndex < (currentSession?.artifacts.length || 0) - 1;
      } else {
          canGoBack = currentSessionIndex > 0;
          canGoForward = currentSessionIndex < sessions.length - 1;
      }
  }

  // Define the download action for the full page drawer
  const fullPageDownloadAction = drawerState.mode === 'full-page' && drawerState.data ? (
      <div style={{ display: 'flex', gap: '8px' }}>
          <button 
              onClick={() => setIsFullPageImproving(!isFullPageImproving)} 
              className="close-button"
              title="Improve this page"
              style={{ width: 'auto', padding: '0 12px', borderRadius: '20px', fontSize: '0.9rem', color: isFullPageImproving ? '#a855f7' : undefined }}
          >
              <MagicWandIcon /> <span style={{marginLeft: '6px'}}>Improve</span>
          </button>
          <button 
              onClick={() => handleDownload(drawerState.data, 'flash-ui-homepage')} 
              className="close-button"
              title="Download Homepage HTML"
              style={{ width: 'auto', padding: '0 12px', borderRadius: '20px', fontSize: '0.9rem' }}
          >
              <DownloadIcon /> <span style={{marginLeft: '6px'}}>Download</span>
          </button>
      </div>
  ) : null;

  return (
    <>
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />

        <button 
            className="model-toggle" 
            onClick={toggleModel} 
            title={`Switch to ${LLM_PROVIDERS[(LLM_PROVIDERS.findIndex(p => p.id === activeProvider) + 1) % LLM_PROVIDERS.length].label}`}
            aria-label={`Current provider: ${activeProvider}`}
        >
            {activeProvider === 'ollama' || activeProvider === 'lm-studio' ? <BrainIcon /> : (activeProvider === 'gemini-flash' ? <ZapIcon /> : <DiamondIcon />)}
            <span>{LLM_PROVIDERS.find(p => p.id === activeProvider)?.label || activeProvider}</span>
        </button>

        <button 
            className="skills-toggle" 
            onClick={() => setDrawerState({ isOpen: true, mode: 'skills', title: 'Skills Management', data: null })} 
            title="Manage AI Skills"
        >
            <BrainIcon />
            <span>Skills</span>
        </button>

        <button
            className="variant-toggle"
            onClick={cycleVariantCount}
            title={`Generate ${variantCount} variant${variantCount > 1 ? 's' : ''}`}
            aria-label={`Generate ${variantCount} variant${variantCount > 1 ? 's' : ''}`}
        >
            <span>{variantCount}x</span>
        </button>

        <a href="https://x.com/ammaar" target="_blank" rel="noreferrer" className={`creator-credit ${hasStarted ? 'hide-on-mobile' : ''}`}>
            created by @ammaar
        </a>

        <SideDrawer 
            isOpen={drawerState.isOpen} 
            onClose={() => setDrawerState(s => ({...s, isOpen: false}))} 
            title={drawerState.title}
            className={drawerState.mode === 'full-page' ? 'wide' : ''}
            action={fullPageDownloadAction}
        >
            {isLoadingDrawer && (
                 <div className="loading-state">
                     <ThinkingIcon /> 
                     {drawerState.mode === 'full-page' ? 'Building homepage...' : 'Designing variations...'}
                 </div>
            )}

            {drawerState.mode === 'code' && (
                <pre className="code-block"><code>{drawerState.data}</code></pre>
            )}
            
            {drawerState.mode === 'variations' && (
                <div className="sexy-grid">
                    {componentVariations.map((v, i) => (
                         <div key={i} className="sexy-card" onClick={() => applyVariation(v.html)}>
                             <div className="sexy-preview">
                                 <iframe srcDoc={v.html} title={v.name} sandbox="allow-scripts allow-same-origin" />
                             </div>
                             <div className="sexy-label">{v.name}</div>
                         </div>
                    ))}
                </div>
            )}

            {drawerState.mode === 'history' && (
                <div className="history-list">
                    {sessions.length === 0 && (
                        <div style={{textAlign:'center', color: '#666', marginTop: '20px'}}>No history yet.</div>
                    )}
                    {sessions.slice().reverse().map((session, i) => {
                         // Because we reversed, calculate original index
                         const originalIndex = sessions.length - 1 - i;
                         return (
                             <div key={session.id} className={`history-item ${originalIndex === currentSessionIndex ? 'active' : ''}`} onClick={() => handleRestoreSession(originalIndex)}>
                                 <div className="history-info">
                                     <div className="history-prompt">{session.prompt}</div>
                                     <div className="history-meta">{new Date(session.timestamp).toLocaleTimeString()}</div>
                                 </div>
                                 <div className="history-actions">
                                     <button onClick={(e) => handleDeleteSession(originalIndex, e)} title="Delete session">
                                         <TrashIcon />
                                     </button>
                                 </div>
                             </div>
                         );
                    })}
                    {sessions.length > 0 && (
                        <button className="clear-history-btn" onClick={handleClearHistory}>
                            Clear All History
                        </button>
                    )}
                </div>
            )}

            {drawerState.mode === 'skills' && (
                <SkillsManager skills={skills} onUpdateSkills={setSkills} />
            )}

            {drawerState.mode === 'full-page' && (
                <>
                    {drawerState.data && (
                        <iframe 
                            srcDoc={drawerState.data} 
                            title="Full Page Preview" 
                            className="full-page-frame"
                            sandbox="allow-scripts allow-same-origin" 
                        />
                    )}
                    {isFullPageImproving && (
                         <PromptInput 
                             inputValue={fullPageInputValue}
                             setInputValue={setFullPageInputValue}
                             selectedImage={null}
                             onImageUpload={() => {}}
                             onRemoveImage={(e) => {e.preventDefault()}}
                             isLoading={isLoading}
                             currentPlaceholder="How should we improve this page?"
                             onSendMessage={handleImproveFullPage}
                             isImproving={true}
                             onCancelImprove={() => setIsFullPageImproving(false)}
                             activeSkills={skills.filter(s => s.isActive)}
                         />
                    )}
                </>
            )}
        </SideDrawer>

        <div className="immersive-app">
            <DottedGlowBackground 
                gap={24} 
                radius={1.5} 
                color={theme === 'dark' ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.03)"}
                glowColor={theme === 'dark' ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)"}
                speedScale={0.5} 
            />

            <div className={`stage-container ${focusedArtifactIndex !== null ? 'mode-focus' : 'mode-split'}`}>
                 <div className={`empty-state ${hasStarted ? 'fade-out' : ''}`}>
                     <div className="empty-content">
                         <h1>Flash UI</h1>
                         <p>Creative UI generation in a flash</p>
                         <button className="surprise-button" onClick={handleSurpriseMe} disabled={isLoading}>
                             <SparklesIcon /> Surprise Me
                         </button>
                     </div>
                 </div>

                {sessions.map((session, sIndex) => {
                    let positionClass = 'hidden';
                    if (sIndex === currentSessionIndex) positionClass = 'active-session';
                    else if (sIndex < currentSessionIndex) positionClass = 'past-session';
                    else if (sIndex > currentSessionIndex) positionClass = 'future-session';
                    
                    return (
                        <div key={session.id} className={`session-group ${positionClass}`}>
                            <div className="artifact-grid" ref={sIndex === currentSessionIndex ? gridScrollRef : null}>
                                {session.artifacts.map((artifact, aIndex) => {
                                    const isFocused = focusedArtifactIndex === aIndex;
                                    
                                    return (
                                        <ArtifactCard 
                                            key={artifact.id}
                                            artifact={artifact}
                                            isFocused={isFocused}
                                            onClick={() => setFocusedArtifactIndex(aIndex)}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

             {canGoBack && (
                <button className="nav-handle left" onClick={prevItem} aria-label="Previous">
                    <ArrowLeftIcon />
                </button>
             )}
             {canGoForward && (
                <button className="nav-handle right" onClick={nextItem} aria-label="Next">
                    <ArrowRightIcon />
                </button>
             )}

            <ActionBar 
                isVisible={focusedArtifactIndex !== null}
                currentPrompt={currentSession?.prompt}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undo}
                onRedo={redo}
                onClearFocus={() => setFocusedArtifactIndex(null)}
                onGenerateVariations={handleGenerateVariations}
                onGenerateFullPage={handleGenerateFullPage}
                onDownload={() => handleDownload()}
                onShowCode={handleShowCode}
                onShowHistory={handleShowHistory}
                onDuplicate={handleDuplicateArtifact}
                onImprove={handleEnterImproveMode}
                isLoading={isLoading}
            />

            <PromptInput 
                inputValue={inputValue}
                setInputValue={setInputValue}
                selectedImage={selectedImage}
                onImageUpload={handleImageUpload}
                onRemoveImage={handleRemoveImage}
                isLoading={isLoading}
                currentPlaceholder={placeholders[placeholderIndex]}
                generatingPrompt={currentSession?.prompt}
                onSendMessage={() => handleSendMessage()}
                isImproving={isImproving}
                onCancelImprove={handleCancelImprove}
                activeSkills={skills.filter(s => s.isActive)}
            />

            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
    </>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
