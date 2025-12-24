/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

//Vibe coded by ammaar@google.com

import { GoogleGenAI } from '@google/genai';
import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

import { Artifact, Session, ComponentVariation } from './types';
import { INITIAL_PLACEHOLDERS } from './constants';
import { generateId } from './utils';

import DottedGlowBackground from './components/DottedGlowBackground';
import SideDrawer from './components/SideDrawer';
import TopNavBar from './components/TopNavBar';
import PromptInput from './components/PromptInput';
import SessionStage from './components/SessionStage';
import {
    ThinkingIcon,
    CodeIcon,
    SparklesIcon,
    GridIcon,
    LayoutIcon,
    DownloadIcon
} from './components/Icons';

import { useSessions } from './hooks/useSessions';
import { useAI } from './hooks/useAI';
import { useToast } from './hooks/useToast';

function App() {
    const { showToast, ToastComponent } = useToast();

    const {
        sessions,
        currentSessionIndex,
        setCurrentSessionIndex,
        focusedArtifactIndex,
        setFocusedArtifactIndex,
        addSession,
        updateSessionArtifacts,
        updateArtifact,
        nextItem,
        prevItem,
        currentSession,
        isLoaded: isSessionsLoaded
    } = useSessions();

    const {
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
        refreshModels,
    } = useAI();

    const [inputValue, setInputValue] = useState<string>('');
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [placeholders, setPlaceholders] = useState<string[]>(INITIAL_PLACEHOLDERS);

    const [drawerState, setDrawerState] = useState<{
        isOpen: boolean;
        mode: 'code' | 'variations' | null;
        title: string;
        data: any;
    }>({ isOpen: false, mode: null, title: '', data: null });

    const [componentVariations, setComponentVariations] = useState<ComponentVariation[]>([]);

    const gridScrollRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

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
                const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
                if (!apiKey) return;
                const ai = new GoogleGenAI({ apiKey });
                const response = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: {
                        role: 'user',
                        parts: [{
                            text: 'Generate 20 creative, short, diverse UI component prompts (e.g. "bioluminescent task list"). Return ONLY a raw JSON array of strings. IP SAFEGUARD: Avoid referencing specific famous artists, movies, or brands.'
                        }]
                    }
                });
                const text = response.text || '[]';
                const jsonMatch = text.match(/[\[\s\S]*\]/);
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
        // Only fetch if sessions are loaded to avoid lag
        if (isSessionsLoaded) {
            setTimeout(fetchDynamicPlaceholders, 1000);
        }
    }, [isSessionsLoaded]);

    const handleGenerateVariations = useCallback(async () => {
        if (!currentSession || focusedArtifactIndex === null) return;
        const currentArtifact = currentSession.artifacts[focusedArtifactIndex];

        setIsLoading(true);
        setComponentVariations([]);
        setDrawerState({ isOpen: true, mode: 'variations', title: 'Variations', data: currentArtifact.id });

        try {
            const prompt = `
You are a master UI/UX designer. Generate 3 RADICAL CONCEPTUAL VARIATIONS of: "${currentSession.prompt}".

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
\
{ 
    "name": "Persona Name", 
    "html": "..."
}
        `.trim();

            const responseStream = streamContent(prompt, 1.2);

            for await (const variation of parseJsonStream(responseStream)) {
                if (variation.name && variation.html) {
                    setComponentVariations(prev => [...prev, variation]);
                }
            }
        } catch (e: any) {
            console.error("Error generating variations:", e);
            showToast(`Error generating variations: ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [sessions, currentSessionIndex, focusedArtifactIndex, streamContent, parseJsonStream, setIsLoading, showToast]);

    const applyVariation = (html: string) => {
        if (focusedArtifactIndex === null || !currentSession) return;
        const artifactId = currentSession.artifacts[focusedArtifactIndex].id;
        updateArtifact(currentSession.id, artifactId, { html, status: 'complete' });
        setDrawerState(s => ({ ...s, isOpen: false }));
    };

    const handleShowCode = () => {
        if (currentSession && focusedArtifactIndex !== null) {
            const artifact = currentSession.artifacts[focusedArtifactIndex];
            setDrawerState({ isOpen: true, mode: 'code', title: 'Source Code', data: artifact.html });
        }
    };

    const handleDownload = () => {
        if (currentSession && focusedArtifactIndex !== null) {
            const artifact = currentSession.artifacts[focusedArtifactIndex];
            const blob = new Blob([artifact.html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `flash-ui-${artifact.styleName.replace(/\s+/g, '-').toLowerCase()}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast("File downloaded successfully", "success");
        }
    };

    const handleGenerateHomepage = useCallback(async () => {
        if (!currentSession || focusedArtifactIndex === null) return;
        const currentArtifact = currentSession.artifacts[focusedArtifactIndex];

        setIsLoading(true);
        const sessionId = generateId();

        const placeholderArtifacts: Artifact[] = [{
            id: `${sessionId}_homepage`,
            styleName: 'Generating Full Homepage...',
            html: '',
            status: 'streaming',
        }];

        const prompt = `Full Homepage - ${currentSession.prompt}`;
        const newSessionId = addSession(prompt, placeholderArtifacts);

        try {
            const promptText = `
You are a master UI/UX designer creating a complete homepage.

**REFERENCE COMPONENT TO EXPAND FROM:**
Style: "${currentArtifact.styleName}"
Original prompt: "${currentSession.prompt}"

Here is the ACTUAL component you're expanding from:
\`\`\`html
${currentArtifact.html}
\`\`\`

**TASK:**
EXPAND this component into a FULL SCROLLING HOMEPAGE with 8 UNIQUE HORIZONTAL SECTIONS.
Study the reference component above carefully - analyze its visual language, typography, colors, spacing, and design metaphor.
Then create 8 completely different sections that EXPAND ON and EVOLVE this concept.

Each section should be completely different in layout, rhythm, and content structure.
Make each section as VISUALLY UNIQUE and UNEXPECTED as possible.

**CREATIVE FREEDOM:**
- Expand on the concept shown in the reference component
- Invent what each section contains based on evolving the original idea
- Vary layouts dramatically between sections (grids, asymmetric, centered, offset, overlapping)
- Alternate content density (minimal → rich → minimal rhythm)
- Mix backgrounds (solid, gradient, transparent, textured)
- Vary spacing and scale between sections
- Create visual surprise while maintaining the EXACT SAME aesthetic DNA
- Each section should feel like entering a different "room" of the same design world

**CRITICAL RULES:**
- Use the EXACT SAME visual language, typography, colors, and design metaphor as the reference component above
- EXPAND and EVOLVE the concept - don't reinvent it
- Make it production-ready with complete HTML/CSS
- Include realistic, creative placeholder content
- Make it fully responsive and visually stunning
- DO NOT repeat layouts - each section must be structurally unique

Output ONLY the complete HTML with embedded CSS. No markdown formatting.
        `.trim();

            const responseStream = streamContent(promptText, 0.9);

            let accumulatedHtml = '';
            for await (const chunk of responseStream) {
                const text = chunk.text || '';
                accumulatedHtml += text;
                const cleanedHtml = accumulatedHtml.replace(/^```html\n?/i, '').replace(/\n?```$/i, '');

                updateArtifact(newSessionId, `${sessionId}_homepage`, { html: cleanedHtml, status: 'streaming' });
            }

            updateArtifact(newSessionId, `${sessionId}_homepage`, { styleName: currentArtifact.styleName, status: 'complete' });

        } catch (e: any) {
            console.error("Error generating homepage:", e);
            showToast(`Error generating homepage: ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [sessions, currentSessionIndex, focusedArtifactIndex, addSession, updateArtifact, streamContent, setIsLoading, showToast]);

    const handleSendMessage = useCallback(async (manualPrompt?: string) => {
        const promptToUse = manualPrompt || inputValue;
        const trimmedInput = promptToUse.trim();

        if (!trimmedInput || isLoading) return;
        if (!manualPrompt) setInputValue('');

        setIsLoading(true);

        const isRefining = focusedArtifactIndex !== null && currentSession;

        if (isRefining) {
            const currentArtifact = currentSession!.artifacts[focusedArtifactIndex!];
            const newArtifactId = generateId();

            updateSessionArtifacts(currentSession!.id, (prev) => [
                ...prev,
                {
                    id: newArtifactId,
                    styleName: `Refined: ${trimmedInput}`,
                    html: '',
                    status: 'streaming'
                }
            ]);

            setFocusedArtifactIndex(currentSession!.artifacts.length);

            try {
                const prompt = `
You are an expert UI engineer refining a component.

**USER REQUEST:** "${trimmedInput}"

**CURRENT CODE:**
\`\`\`html
${currentArtifact.html}
\`\`\`

**TASK:**
Update the code to satisfy the user request while maintaining the existing design language, quality, and responsiveness.
Return the FULLY UPDATED HTML.
            `.trim();

                const responseStream = streamContent(prompt);
                let accumulatedHtml = '';

                for await (const chunk of responseStream) {
                    const text = chunk.text;
                    if (typeof text === 'string') {
                        accumulatedHtml += text;
                        updateArtifact(currentSession!.id, newArtifactId, { html: accumulatedHtml });
                    }
                }

                let finalHtml = accumulatedHtml.trim();
                if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
                if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
                if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();

                updateArtifact(currentSession!.id, newArtifactId, {
                    html: finalHtml,
                    status: finalHtml ? 'complete' : 'error'
                });

            } catch (e: any) {
                console.error("Error refining artifact:", e);
                updateArtifact(currentSession!.id, newArtifactId, { status: 'error', html: `Error: ${e.message}` });
                showToast(`Error refining: ${e.message}`, 'error');
            } finally {
                setIsLoading(false);
            }

        } else {
            const sessionId = generateId();
            const placeholderArtifacts: Artifact[] = Array(3).fill(null).map((_, i) => ({
                id: `${sessionId}_${i}`,
                styleName: 'Designing...',
                html: '',
                status: 'streaming',
            }));

            const newSessionId = addSession(trimmedInput, placeholderArtifacts);

            try {
                const stylePrompt = `
Generate 3 distinct, highly evocative design directions for: "${trimmedInput}".

**STRICT IP SAFEGUARD:**
Never use artist or brand names. Use physical and material metaphors.

**CREATIVE EXAMPLES (Do not simply copy these, use them as a guide for tone):**
- Example A: "Asymmetrical Rectilinear Blockwork" (Grid-heavy, primary pigments, thick structural strokes, Bauhaus-functionalism vibe).
- Example B: "Grainy Risograph Layering" (Tactile paper texture, overprinted translucent inks, dithered gradients).
- Example C: "Kinetic Wireframe Suspension" (Floating silhouettes, thin balancing lines, organic primary shapes).
- Example D: "Spectral Prismatic Diffusion" (Glassmorphism, caustic refraction, soft-focus morphing gradients).

**GOAL:**
Return ONLY a raw JSON array of 3 *NEW*, creative names for these directions (e.g. ["Tactile Risograph Press", "Kinetic Silhouette Balance", "Primary Pigment Gridwork"]).
            `.trim();

                const styleText = await generateContent(stylePrompt);

                let generatedStyles: string[] = [];
                const jsonMatch = styleText.match(/[\[\s\S]*\]/);

                if (jsonMatch) {
                    try {
                        generatedStyles = JSON.parse(jsonMatch[0]);
                    } catch (e) {
                        console.warn("Failed to parse styles, using fallbacks");
                    }
                }

                if (!generatedStyles || generatedStyles.length < 3) {
                    generatedStyles = [
                        "Primary Pigment Gridwork",
                        "Tactile Risograph Layering",
                        "Kinetic Silhouette Balance"
                    ];
                }

                generatedStyles = generatedStyles.slice(0, 3);

                updateSessionArtifacts(newSessionId, (artifacts) => {
                    return artifacts.map((art, i) => ({
                        ...art,
                        styleName: generatedStyles[i] || art.styleName
                    }));
                });

                const generateArtifact = async (artifact: Artifact, styleInstruction: string) => {
                    try {
                        const prompt = `
You are Flash UI. Create a stunning, high-fidelity UI component for: "${trimmedInput}".

**CONCEPTUAL DIRECTION: ${styleInstruction}**

**VISUAL EXECUTION RULES:**
1. **Materiality**: Use the specified metaphor to drive every CSS choice. (e.g. if Risograph, use \
feTurbulence\
 for grain and \
mix-blend-mode: multiply\
 for ink layering).
2. **Typography**: Use high-quality web fonts. Pair a bold sans-serif with a refined monospace for data.
3. **Motion**: Include subtle, high-performance CSS/JS animations (hover transitions, entry reveals).
4. **IP SAFEGUARD**: No artist names or trademarks. 
5. **Layout**: Be bold with negative space and hierarchy. Avoid generic cards.

Return ONLY RAW HTML. No markdown fences.
            `.trim();

                        const responseStream = streamContent(prompt);

                        let accumulatedHtml = '';
                        for await (const chunk of responseStream) {
                            const text = chunk.text;
                            if (typeof text === 'string') {
                                accumulatedHtml += text;
                                updateArtifact(newSessionId, artifact.id, { html: accumulatedHtml });
                            }
                        }

                        let finalHtml = accumulatedHtml.trim();
                        if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
                        if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
                        if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();

                        updateArtifact(newSessionId, artifact.id, {
                            html: finalHtml,
                            status: finalHtml ? 'complete' : 'error'
                        });

                    } catch (e: any) {
                        console.error('Error generating artifact:', e);
                        updateArtifact(newSessionId, artifact.id, {
                            html: `<div style="color: #ff6b6b; padding: 20px;">Error: ${e.message}</div>`,
                            status: 'error'
                        });
                    }
                };

                await Promise.all(placeholderArtifacts.map((art, i) => generateArtifact(art, generatedStyles[i])));

            } catch (e: any) {
                console.error("Fatal error in generation process", e);
                showToast(`Fatal error: ${e.message}`, 'error');
            } finally {
                setIsLoading(false);
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }
    }, [inputValue, isLoading, sessions, currentSessionIndex, focusedArtifactIndex, addSession, updateSessionArtifacts, updateArtifact, generateContent, streamContent, showToast]);

    const handleSurpriseMe = () => {
        const currentPrompt = placeholders[placeholderIndex];
        setInputValue(currentPrompt);
        handleSendMessage(currentPrompt);
    };

    const hasStarted = sessions.length > 0 || isLoading;

    // Computed navigation state
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

    // Refine mode detection for input
    const isRefining = focusedArtifactIndex !== null;

    return (
        <>
            <ToastComponent />
            <TopNavBar
                hasStarted={hasStarted}
                provider={provider}
                setProvider={setProvider}
                modelId={modelId}
                setModelId={setModelId}
                useTailwind={useTailwind}
                setUseTailwind={setUseTailwind}
                isLoading={isLoading}
                models={models}

            />

            <SideDrawer
                isOpen={drawerState.isOpen}
                onClose={() => setDrawerState(s => ({ ...s, isOpen: false }))}
                title={drawerState.title}
            >
                {drawerState.isOpen && isLoading && drawerState.mode === 'variations' && componentVariations.length === 0 && (
                    <div className="loading-state">
                        <ThinkingIcon />
                        Designing variations...
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
            </SideDrawer>

            <div className="immersive-app">
                <DottedGlowBackground
                    gap={24}
                    radius={1.5}
                    color="rgba(255, 255, 255, 0.02)"
                    glowColor="rgba(255, 255, 255, 0.15)"
                    speedScale={0.5}
                />

                <SessionStage
                    sessions={sessions}
                    currentSessionIndex={currentSessionIndex}
                    focusedArtifactIndex={focusedArtifactIndex}
                    setFocusedArtifactIndex={setFocusedArtifactIndex}
                    isLoading={isLoading}
                    hasStarted={hasStarted}
                    handleSurpriseMe={handleSurpriseMe}
                    gridScrollRef={gridScrollRef}
                    navNext={nextItem}
                    navPrev={prevItem}
                    canGoBack={canGoBack}
                    canGoForward={canGoForward}
                />

                <div className={`action-bar ${focusedArtifactIndex !== null ? 'visible' : ''}`}>
                    <div className="active-prompt-label">
                        {currentSession?.prompt}
                    </div>
                    <div className="action-buttons">
                        <button onClick={() => setFocusedArtifactIndex(null)}>
                            <GridIcon /> Grid View
                        </button>
                        <button onClick={handleGenerateVariations} disabled={isLoading}>
                            <SparklesIcon /> Variations
                        </button>
                        <button onClick={handleGenerateHomepage} disabled={isLoading}>
                            <LayoutIcon /> Full Homepage
                        </button>
                        <button onClick={handleShowCode}>
                            <CodeIcon /> Source
                        </button>
                        <button onClick={handleDownload} title="Download HTML">
                            <DownloadIcon /> Download
                        </button>
                    </div>
                </div>

                <PromptInput
                    inputValue={inputValue}
                    setInputValue={setInputValue}
                    isLoading={isLoading}
                    placeholders={placeholders}
                    placeholderIndex={placeholderIndex}
                    currentPrompt={isRefining ? `Refine this design...` : currentSession?.prompt}
                    onSend={handleSendMessage}
                />
            </div>
        </>
    );
}

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<React.StrictMode><App /></React.StrictMode>);
}