# Flash UI (Local Edition)

An advanced, AI-powered UI component generator that creates high-fidelity design variations in real-time. This version is enhanced with **Local AI support (LM Studio)**, **Session Persistence**, **Iterative Refinement**, and **Tailwind CSS generation**.

![AI Design Tool](https://img.shields.io/badge/AI-Design%20Tool-blue) ![React](https://img.shields.io/badge/React-19.0-61dafb) ![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6) ![Vite](https://img.shields.io/badge/Vite-6.0-646cff)

## 🚀 Key Features

- **🤖 Multi-Model Support**:
  - **Google Gemini**: Fast, cloud-based generation.
  - **OpenRouter**: Access to Claude, GPT-4, Llama 3 via API.
  - **LM Studio (Local)**: **NEW!** Run models locally on your own hardware for privacy and zero cost.
- **💾 Session Persistence**: **NEW!** Your designs and history are automatically saved to `localStorage`. Never lose a spark of inspiration.
- **✨ Iterative Refinement**: **NEW!** Click on any generated design to enter "Refine Mode". Chat with the AI to tweak colors, layout, or content instantly.
- **🎨 Tailwind CSS Support**: **NEW!** Toggle between raw CSS and Tailwind utility classes for generated components.
- **📥 One-Click Export**: **NEW!** Download any generated component as a standalone `.html` file.
- **⚡ Real-time Streaming**: Watch designs render live as the AI generates code.
- **📱 Responsive & Immersive**: A glassmorphic, mobile-friendly interface with 3D card effects.

## 🛠️ Quick Start

### Prerequisites

- Node.js 18+ installed
- API keys (optional, depending on provider):
  - Google Gemini API (get from [Google AI Studio](https://makersuite.google.com/app/apikey))
  - OpenRouter API (get from [OpenRouter](https://openrouter.ai/keys))
- [LM Studio](https://lmstudio.ai/) (for local inference)

### Installation

```bash
# Clone the repository
git clone https://github.com/mushfiqk47/Local-Flash-UI.git
cd Local-Flash-UI

# Install dependencies
npm install
```

### Configuration

Create a `.env` file in the root directory:

```env
# Cloud Providers (Optional if using Local AI)
GEMINI_API_KEY=your_gemini_key_here
OPENROUTER_API_KEY=your_openrouter_key_here

# Local Provider (Default: http://localhost:1234)
LM_STUDIO_URL=http://localhost:1234
```

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🎯 How to Use

### 1. Choose Your Brain 🧠
Use the **Top Nav Bar** to select your AI provider:
- **Gemini**: Best for speed and creative layouts.
- **OpenRouter**: Access top-tier models like Claude 3.5 Sonnet.
- **LM Studio**: Point to your local server. Ensure LM Studio is running and the "Local Inference Server" is started.

### 2. Generate UI 🎨
Type a prompt in the bottom bar (e.g., *"A cyberpunk crypto dashboard"*).
- **Tailwind Toggle**: Switch "Tailwind ON" in the top bar to generate utility-first CSS.

### 3. Refine & Iterate 🛠️
Click on any design card to focus it.
- The input prompt changes to **"Refine this design..."**.
- Type instructions like *"Make the background darker"* or *"Add a user profile picture"*.
- The AI will update the code in real-time.

### 4. Export 📤
Click the **Download** button in the action bar to save your design as a production-ready HTML file.

---

## 🏗️ Architecture

The project has been refactored for modularity and scalability:

```
flash-ui/
├── index.tsx              # Application entry point
├── components/            # UI Components
│   ├── TopNavBar.tsx      # Model selector & settings
│   ├── SessionStage.tsx   # Grid of artifact cards
│   ├── PromptInput.tsx    # Floating input bar
│   ├── ArtifactCard.tsx   # Individual design preview
│   └── SideDrawer.tsx     # Code viewer & variations
├── hooks/                 # Custom React Hooks
│   ├── useAI.ts           # AI generation, streaming, & providers
│   ├── useSessions.ts     # State management & localStorage persistence
│   └── useToast.ts        # Notification system
├── types.ts               # TypeScript definitions
└── utils.ts               # Helper functions
```

## 🔧 Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Custom CSS with Glassmorphism effects + Tailwind support
- **AI Integration**: Google GenAI SDK, Fetch API (OpenRouter/LM Studio)
- **State**: React Hooks + LocalStorage

## 📝 Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Apache 2.0

## 🙏 Credits

Original concept by [ammaar](https://x.com/ammaar).
Refactored and enhanced by [mushfiqk47](https://github.com/mushfiqk47).