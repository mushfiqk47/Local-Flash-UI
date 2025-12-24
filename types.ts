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

export type AIModel = 'gemini' | 'glm-4.7' | 'local-model' | string;
export type AIProvider = 'gemini' | 'openrouter' | 'lmstudio';

export interface ModelOption {
  id: AIModel;
  name: string;
  provider: string;
}