# Flash UI 2.0

Creative UI generation powered by AI. Generate production-ready HTML/CSS components from text prompts with multiple LLM providers.

## Features

- **Multi-provider AI**: Gemini Flash, Gemini Pro, Ollama, LM Studio
- **Skill system**: Attach custom expertise prompts to guide every generation
- **Variant control**: Generate 1-3 design variants per prompt
- **Theme support**: Dark/light mode with persistent preference
- **Artifact management**: History, undo/redo, duplication, inline improvement
- **Full page generation**: Expand any component into a complete landing page
- **Export**: Download generated HTML files

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Copy `.env.example` to `.env` and configure:
   ```
   VITE_GEMINI_API_KEY=your_gemini_api_key
   VITE_LLM_PROVIDER=gemini
   VITE_OLLAMA_BASE_URL=http://localhost:11434
   VITE_LM_STUDIO_BASE_URL=http://localhost:1234/v1
   ```

3. Run:
   ```
   npm run dev
   ```

Or double-click `run.bat` (Windows).

## Usage

1. Type a prompt (e.g. "minimalist weather card") and press Enter
2. Three design variants are generated — click one to focus
3. Use the action bar to: improve, duplicate, generate variations, expand to full page, export, view source
4. Toggle skills (top-left brain icon) to attach expertise prompts that guide the AI
5. Adjust variant count (1x/2x/3x button) before generating

## LLM Providers

| Provider | Stream | Non-stream | System Prompt |
|----------|--------|------------|---------------|
| Gemini   | `streamGenerateContent` | `generateContent` | `systemInstruction` |
| Ollama   | `/api/generate stream` | `/api/generate` | `system` field |
| LM Studio | `/v1/chat/completions stream` | `/v1/chat/completions` | `system` role |

Active skills are passed as system instructions to all providers, ensuring every generation respects your custom expertise.
