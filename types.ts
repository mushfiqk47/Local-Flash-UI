/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Artifact {
  id: string;
  styleName: string;
  html: string;
  status: 'streaming' | 'complete' | 'error';
}

export interface Session {
    id: string;
    prompt: string;
    timestamp: number;
    artifacts: Artifact[];
}

export interface ComponentVariation { name: string; html: string; }
export interface LayoutOption { name: string; css: string; previewHtml: string; }

export interface Skill {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

export type LLMProviderId = 'gemini-flash' | 'gemini-pro' | 'ollama' | 'lm-studio';

export const LLM_PROVIDERS: { id: LLMProviderId; label: string; icon: string }[] = [
    { id: 'gemini-flash', label: 'Flash', icon: 'zap' },
    { id: 'gemini-pro', label: 'Pro', icon: 'diamond' },
    { id: 'ollama', label: 'Ollama', icon: 'brain' },
    { id: 'lm-studio', label: 'LM Studio', icon: 'brain' },
];