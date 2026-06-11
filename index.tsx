
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

//Vibe coded by ammaar@google.com

import { GoogleGenAI } from '@google/genai';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import { Artifact, Session, ComponentVariation, LayoutOption, Skill, LLMProviderId, LLM_PROVIDERS } from './types';
import { INITIAL_PLACEHOLDERS } from './constants';
import { generateId, extractBase64, parseJsonStream, sanitizeFilename } from './utils';

import DottedGlowBackground from './components/DottedGlowBackground';
import AppStage from './components/AppStage';
import SideDrawer from './components/SideDrawer';
import PromptInput from './components/PromptInput';
import ActionBar from './components/ActionBar';
import ThemeToggle from './components/ThemeToggle';
import SkillsManager from './components/SkillsManager';
import { ToastContainer, useToast } from './components/Toast';
import ModelToggleButton from './components/ModelToggleButton';
import SkillsToggleButton from './components/SkillsToggleButton';
import VariantCountButton from './components/VariantCountButton';
import DrawerContentRenderer from './components/DrawerContentRenderer';

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

    async function* read(): AsyncGenerator<{ text: string }> {
        const { done, value } = await reader.read();
        if (done) return;
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
        yield* read();
    }
    yield* read();
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

    async function* read(): AsyncGenerator<{ text: string }> {
        const { done, value } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') return;
            try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content || '';
                if (content) yield { text: content };
            } catch (e) {}
        }
        yield* read();
    }
    yield* read();
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
  const { toasts, addToast, dismissToast } = useToast();
  
  // Group settings state to satisfy "Many related useState calls" warning
  const [settings, setSettingsState] = useState({
      theme: ((localStorage.getItem('flash-ui-theme') as 'dark' | 'light') || 'dark'),
      activeProvider: (() => {
          const saved = localStorage.getItem('flash-ui-provider') as LLMProviderId | null;
          if (saved && LLM_PROVIDERS.some(p => p.id === saved)) return saved;
          return getDefaultProvider();
      })(),
      variantCount: 3,
  });

  const { theme, activeProvider, variantCount } = settings;

  const setTheme = useCallback((val: 'dark' | 'light' | ((prev: 'dark' | 'light') => 'dark' | 'light')) => {
      setSettingsState(prev => {
          const newTheme = typeof val === 'function' ? val(prev.theme) : val;
          localStorage.setItem('flash-ui-theme', newTheme);
          return { ...prev, theme: newTheme };
      });
  }, []);

  const setActiveProvider = useCallback((val: LLMProviderId | ((prev: LLMProviderId) => LLMProviderId)) => {
      setSettingsState(prev => {
          const newProvider = typeof val === 'function' ? val(prev.activeProvider) : val;
          localStorage.setItem('flash-ui-provider', newProvider);
          return { ...prev, activeProvider: newProvider };
      });
  }, []);

  const setVariantCount = useCallback((val: number | ((prev: number) => number)) => {
      setSettingsState(prev => {
          const newCount = typeof val === 'function' ? val(prev.variantCount) : val;
          return { ...prev, variantCount: newCount };
      });
  }, []);

  const [skills, setSkills] = useState<Skill[]>(() => {
      try {
          const saved = localStorage.getItem('flash-ui-skills:v1') || localStorage.getItem('flash-ui-skills');
          if (saved) return JSON.parse(saved);
      } catch(e) {}
      return [];
  });

  useEffect(() => {
      localStorage.setItem('flash-ui-skills:v1', JSON.stringify(skills));
  }, [skills]);

  const activeSkillsContext = skills.reduce((acc, s) => {
      if (s.isActive) {
          const chunk = `[Skill: ${s.name}]\n${s.description}`;
          return acc ? `${acc}\n\n${chunk}` : chunk;
      }
      return acc;
  }, '');
  const systemPrompt = buildSystemPrompt(activeSkillsContext);

  const cycleVariantCount = useCallback(() => {
      setVariantCount(prev => prev >= 3 ? 1 : prev + 1);
  }, [setVariantCount]);

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

  // Group editor/UI states to satisfy "Many related useState calls" warning
  const [editorState, setEditorState] = useState({
      currentSessionIndex: -1,
      focusedArtifactIndex: null as number | null,
      inputValue: '',
      selectedImage: null as string | null,
      isLoading: false,
      placeholderIndex: 0,
      placeholders: INITIAL_PLACEHOLDERS,
      drawerState: {
          isOpen: false,
          mode: null as 'code' | 'variations' | 'full-page' | 'history' | 'skills' | null,
          title: '',
          data: null as any,
      },
      componentVariations: [] as ComponentVariation[],
      isImproving: false,
      fullPageInputValue: '',
      isFullPageImproving: false,
  });

  const {
      currentSessionIndex,
      focusedArtifactIndex,
      inputValue,
      selectedImage,
      isLoading,
      placeholderIndex,
      placeholders,
      drawerState,
      componentVariations,
      isImproving,
      fullPageInputValue,
      isFullPageImproving
  } = editorState;

  const setCurrentSessionIndex = useCallback((val: number | ((prev: number) => number)) => {
      setEditorState(prev => ({
          ...prev,
          currentSessionIndex: typeof val === 'function' ? val(prev.currentSessionIndex) : val
      }));
  }, []);

  const setFocusedArtifactIndex = useCallback((val: number | null | ((prev: number | null) => number | null)) => {
      setEditorState(prev => ({
          ...prev,
          focusedArtifactIndex: typeof val === 'function' ? val(prev.focusedArtifactIndex) : val
      }));
  }, []);

  const setInputValue = useCallback((val: string | ((prev: string) => string)) => {
      setEditorState(prev => ({
          ...prev,
          inputValue: typeof val === 'function' ? val(prev.inputValue) : val
      }));
  }, []);

  const setSelectedImage = useCallback((val: string | null | ((prev: string | null) => string | null)) => {
      setEditorState(prev => ({
          ...prev,
          selectedImage: typeof val === 'function' ? val(prev.selectedImage) : val
      }));
  }, []);

  const setIsLoading = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
      setEditorState(prev => ({
          ...prev,
          isLoading: typeof val === 'function' ? val(prev.isLoading) : val
      }));
  }, []);

  const setPlaceholderIndex = useCallback((val: number | ((prev: number) => number)) => {
      setEditorState(prev => ({
          ...prev,
          placeholderIndex: typeof val === 'function' ? val(prev.placeholderIndex) : val
      }));
  }, []);

  const setPlaceholders = useCallback((val: string[] | ((prev: string[]) => string[])) => {
      setEditorState(prev => ({
          ...prev,
          placeholders: typeof val === 'function' ? val(prev.placeholders) : val
      }));
  }, []);

  const setDrawerState = useCallback((val: any | ((prev: any) => any)) => {
      setEditorState(prev => ({
          ...prev,
          drawerState: typeof val === 'function' ? val(prev.drawerState) : val
      }));
  }, []);

  const setComponentVariations = useCallback((val: ComponentVariation[] | ((prev: ComponentVariation[]) => ComponentVariation[])) => {
      setEditorState(prev => ({
          ...prev,
          componentVariations: typeof val === 'function' ? val(prev.componentVariations) : val
      }));
  }, []);

  const setIsImproving = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
      setEditorState(prev => ({
          ...prev,
          isImproving: typeof val === 'function' ? val(prev.isImproving) : val
      }));
  }, []);

  const setFullPageInputValue = useCallback((val: string | ((prev: string) => string)) => {
      setEditorState(prev => ({
          ...prev,
          fullPageInputValue: typeof val === 'function' ? val(prev.fullPageInputValue) : val
      }));
  }, []);

  const setIsFullPageImproving = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
      setEditorState(prev => ({
          ...prev,
          isFullPageImproving: typeof val === 'function' ? val(prev.isFullPageImproving) : val
      }));
  }, []);

  const gridScrollRef = useRef<HTMLDivElement>(null);

  const setFocusedIndexWithScroll = useCallback((index: number | null) => {
      setFocusedArtifactIndex(index);
      if (index !== null && window.innerWidth <= 1024) {
          if (gridScrollRef.current) {
              gridScrollRef.current.scrollTop = 0;
          }
          window.scrollTo(0, 0);
      }
  }, [setFocusedArtifactIndex]);

  // Update theme on document
  useEffect(() => {
      document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
      setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, [setTheme]);

  const toggleModel = useCallback(() => {
      setActiveProvider(prev => {
          const idx = LLM_PROVIDERS.findIndex(p => p.id === prev);
          return LLM_PROVIDERS[(idx + 1) % LLM_PROVIDERS.length].id;
      });
  }, [setActiveProvider]);

  // Cycle placeholders
  useEffect(() => {
      const interval = setInterval(() => {
          setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
      }, 3000);
      return () => clearInterval(interval);
  }, [placeholders.length, setPlaceholderIndex]);

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
      const timer = setTimeout(fetchDynamicPlaceholders, 1000);
      return () => clearTimeout(timer);
  }, [setPlaceholders]);

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
  }, [focusedArtifactIndex, setIsImproving, setInputValue]);

  const handleCancelImprove = useCallback(() => {
      setIsImproving(false);
      setInputValue('');
  }, [setIsImproving, setInputValue]);

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
- Generate high-fidelity interactive HTML/CSS. Use HSL colors, Google Fonts, and Lucide icons.
- Center the component layout beautifully inside the body.

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
  }, [sessions, currentSessionIndex, focusedArtifactIndex, getResponseStream, variantCount, addToast, setIsLoading, setComponentVariations, setDrawerState, setFullPageInputValue, setIsFullPageImproving]);

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
Take a specific UI component and expand it into a COMPLETE, SCROLLABLE, INTERACTIVE HOMEPAGE.

**User Prompt:** "${currentSession.prompt}"
**Style Name:** "${currentArtifact.styleName}"
**Reference Component HTML:**
${currentArtifact.html}

**INSTRUCTIONS:**
1. **Analyze the Reference:** Extract the color palette, typography, border-radius, shadows, gradients, and visual metaphors from the Reference HTML and scale them across a full page.
2. **Build a Premium Landing Page:** Create a comprehensive homepage (Hero, Features/Services, Testimonials, Interactive pricing/sign-up, Footer) that perfectly matches this aesthetic.
3. **Responsive & Viewport Fit**: Ensure it works flawlessly on mobile, tablet, and desktop devices.
4. **Hero Section:** Use the Reference Component HTML as the centerpiece or main visual in the Hero section.
5. **Assets & Icons**: Load Google Fonts (e.g. Outfit, Inter, Syne) and Lucide Icons via CDN:
   <script src="https://unpkg.com/lucide@latest"></script>
   Followed by <script>lucide.createIcons();</script> at the bottom of the page.
6. **Interactivity**: Add smooth scrolling, hover animations, and small JavaScript event listeners for interactive buttons/menus.
7. **Content:** Write realistic, polished copy and mock data relevant to the User Prompt.

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
  }, [sessions, currentSessionIndex, focusedArtifactIndex, getResponseStream, addToast, setIsLoading, setDrawerState, setFullPageInputValue, setIsFullPageImproving]);

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
  }, [drawerState.data, fullPageInputValue, getResponseStream, addToast, setIsLoading, setFullPageInputValue, setDrawerState]);

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

  const applyVariation = useCallback((html: string) => {
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
  }, [currentSessionIndex, focusedArtifactIndex, setSessions, setDrawerState, addToast]);

  const handleShowCode = useCallback(() => {
      const currentSession = sessions[currentSessionIndex];
      if (currentSession && focusedArtifactIndex !== null) {
          const artifact = currentSession.artifacts[focusedArtifactIndex];
          setDrawerState({ isOpen: true, mode: 'code', title: 'Source Code', data: artifact.html });
      }
  }, [sessions, currentSessionIndex, focusedArtifactIndex, setDrawerState]);

  const handleShowHistory = useCallback(() => {
      setDrawerState({ isOpen: true, mode: 'history', title: 'History', data: null });
  }, [setDrawerState]);

  const handleShowSkills = useCallback(() => {
      setDrawerState({ isOpen: true, mode: 'skills', title: 'Skills Management', data: null });
  }, [setDrawerState]);

  const handleRestoreSession = useCallback((index: number) => {
      setCurrentSessionIndex(index);
      setFocusedIndexWithScroll(null);
      setDrawerState(s => ({ ...s, isOpen: false }));
  }, [setCurrentSessionIndex, setFocusedIndexWithScroll, setDrawerState]);

  const handleDeleteSession = useCallback((index: number, e: React.MouseEvent) => {
      e.stopPropagation();
      setSessions(prev => {
          const newSessions = prev.filter((_, i) => i !== index);
          return newSessions;
      }, true); 
      
      setCurrentSessionIndex(prev => {
          if (index === prev) {
              return Math.max(0, index - 1);
          } else if (index < prev) {
              return prev - 1;
          }
          return prev;
      });
  }, [setSessions, setCurrentSessionIndex]);

  const handleClearHistory = useCallback(() => {
      if (window.confirm("Are you sure you want to clear all history?")) {
          setSessions([], true);
          setCurrentSessionIndex(-1);
      }
  }, [setSessions, setCurrentSessionIndex]);

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
    setFocusedIndexWithScroll(null); 
    
    const generationImage = selectedImage;
    if (!manualPrompt) setSelectedImage(null);

    try {
        const stylePrompt = `
Generate ${variantCount} distinct, highly evocative design directions for: "${displayPrompt}".
Return ONLY a raw JSON array of ${variantCount} *NEW*, creative design style names (e.g. ["Neon Glassmorphism", "Monochrome Cyberpunk", "Tactile Risograph Press"]).
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
Create a stunning, high-fidelity, interactive UI component for: "${displayPrompt}".

**CONCEPTUAL DIRECTION: ${styleInstruction}**

**VISUAL EXECUTION RULES:**
1. **Materiality & Colors**: Use the specified metaphor to drive every CSS choice. Pair a bold monochromatic background (e.g. obsidian, off-white, or dark navy) with a single vibrant accent color using custom HSL values. Use smooth gradients, glassmorphism, blur backdrops, and deep shadows where appropriate.
2. **Typography**: Load modern web fonts from Google Fonts (e.g. Outfit, Inter, Syne, JetBrains Mono) via HTML <link> tags.
3. **Icons**: Use beautiful vector icons by loading Lucide Icons from the CDN:
   <script src="https://unpkg.com/lucide@latest"></script>
   Followed by <script>lucide.createIcons();</script> at the bottom of the page to parse all <i data-lucide="..."> elements.
4. **Motion & micro-animations**: Include CSS keyframe entry reveals, hover zoom/slide transitions, and smooth active transitions.
5. **Layout & Responsiveness**: Build a clean, responsive layout. Center the component beautifully inside a full-height body flex/grid container, with a body background color matching the theme of the component (e.g. dark or light).
6. **Interactivity**: Include a small, simple <script> block containing vanilla JavaScript event listeners to make accordion panels, tabs, dropdowns, and button clicks actually work (show/hide or update active states) in the preview iframe.
7. **IP SAFEGUARD**: No artist names or trademarks.

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
  }, [inputValue, selectedImage, isLoading, sessions.length, setSessions, getResponseStream, getResponse, isImproving, currentSessionIndex, focusedArtifactIndex, sessions, variantCount, addToast, setIsLoading, setInputValue, setIsImproving, setSelectedImage, setCurrentSessionIndex, setFocusedIndexWithScroll]);

  const handleSurpriseMe = () => {
      const currentPrompt = placeholders[placeholderIndex];
      setInputValue(currentPrompt);
      handleSendMessage(currentPrompt);
  };

  const nextItem = useCallback(() => {
      if (focusedArtifactIndex !== null) {
          if (focusedArtifactIndex < 2) setFocusedIndexWithScroll(focusedArtifactIndex + 1);
      } else {
          setCurrentSessionIndex(prev => {
              if (prev < sessions.length - 1) return prev + 1;
              return prev;
          });
      }
  }, [sessions.length, focusedArtifactIndex, setFocusedIndexWithScroll, setCurrentSessionIndex]);

  const prevItem = useCallback(() => {
      if (focusedArtifactIndex !== null) {
          if (focusedArtifactIndex > 0) setFocusedIndexWithScroll(focusedArtifactIndex - 1);
      } else {
           setCurrentSessionIndex(prev => {
               if (prev > 0) return prev - 1;
               return prev;
           });
      }
  }, [focusedArtifactIndex, setFocusedIndexWithScroll, setCurrentSessionIndex]);

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
              type="button"
              onClick={() => setIsFullPageImproving(!isFullPageImproving)} 
              className="close-button"
              title="Improve this page"
              style={{ width: 'auto', padding: '0 12px', borderRadius: '20px', fontSize: '0.9rem', color: isFullPageImproving ? '#a855f7' : undefined }}
          >
              <MagicWandIcon /> <span style={{marginLeft: '6px'}}>Improve</span>
          </button>
          <button 
              type="button"
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

        <ModelToggleButton activeProvider={activeProvider} toggleModel={toggleModel} />

        <SkillsToggleButton onClick={() => setDrawerState({ isOpen: true, mode: 'skills', title: 'Skills Management', data: null })} />

        <VariantCountButton variantCount={variantCount} onClick={cycleVariantCount} />

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
            <DrawerContentRenderer 
                drawerMode={drawerState.mode}
                drawerData={drawerState.data}
                isLoadingDrawer={isLoadingDrawer}
                componentVariations={componentVariations}
                sessions={sessions}
                currentSessionIndex={currentSessionIndex}
                skills={skills}
                fullPageInputValue={fullPageInputValue}
                isFullPageImproving={isFullPageImproving}
                isLoading={isLoading}
                applyVariation={applyVariation}
                handleRestoreSession={handleRestoreSession}
                handleDeleteSession={handleDeleteSession}
                handleClearHistory={handleClearHistory}
                setSkills={setSkills}
                setFullPageInputValue={setFullPageInputValue}
                setIsFullPageImproving={setIsFullPageImproving}
                handleImproveFullPage={handleImproveFullPage}
            />
        </SideDrawer>

        <div className="immersive-app">
            <DottedGlowBackground 
                gap={24} 
                radius={1.5} 
                color={theme === 'dark' ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.03)"}
                glowColor={theme === 'dark' ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)"}
                speedScale={0.5} 
            />

            <AppStage 
                hasStarted={hasStarted}
                sessions={sessions}
                currentSessionIndex={currentSessionIndex}
                focusedArtifactIndex={focusedArtifactIndex}
                isLoading={isLoading}
                handleSurpriseMe={handleSurpriseMe}
                setFocusedIndexWithScroll={setFocusedIndexWithScroll}
                gridScrollRef={gridScrollRef}
            />

              {canGoBack && (
                 <button type="button" className="nav-handle left" onClick={prevItem} aria-label="Previous">
                     <ArrowLeftIcon />
                 </button>
              )}
              {canGoForward && (
                 <button type="button" className="nav-handle right" onClick={nextItem} aria-label="Next">
                     <ArrowRightIcon />
                 </button>
              )}

            <ActionBar 
                flags={{
                    isVisible: focusedArtifactIndex !== null,
                    canUndo,
                    canRedo,
                    isLoading
                }}
                currentPrompt={currentSession?.prompt}
                onUndo={undo}
                onRedo={redo}
                onClearFocus={() => setFocusedIndexWithScroll(null)}
                onGenerateVariations={handleGenerateVariations}
                onGenerateFullPage={handleGenerateFullPage}
                onDownload={() => handleDownload()}
                onShowCode={handleShowCode}
                onShowHistory={handleShowHistory}
                onDuplicate={handleDuplicateArtifact}
                onImprove={handleEnterImproveMode}
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
