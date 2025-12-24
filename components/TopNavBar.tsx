import React from 'react';
import { AIProvider } from '../types';

interface TopNavBarProps {
    hasStarted: boolean;
    provider: AIProvider;
    setProvider: (p: AIProvider) => void;
    modelId: string;
    setModelId: (id: string) => void;
    useTailwind: boolean;
    setUseTailwind: (b: boolean) => void;
    isLoading: boolean;
}

const TopNavBar: React.FC<TopNavBarProps> = ({
    hasStarted,
    provider,
    setProvider,
    modelId,
    setModelId,
    useTailwind,
    setUseTailwind,
    isLoading
}) => {
    return (
        <header className={`top-nav-bar ${hasStarted ? 'has-started' : ''}`}>
            <div className="nav-left">
                <div className="model-controls">
                    <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value as AIProvider)}
                        className="provider-selector"
                        disabled={isLoading}
                    >
                        <option value="gemini">Gemini</option>
                        <option value="openrouter">OpenRouter</option>
                        <option value="lmstudio">LM Studio</option>
                    </select>
                    {(provider === 'openrouter' || provider === 'lmstudio') && (
                        <input
                            type="text"
                            value={modelId}
                            onChange={(e) => setModelId(e.target.value)}
                            className="model-id-input"
                            placeholder={provider === 'openrouter' ? "e.g., z-ai/glm-4.7" : "e.g., local-model"}
                            disabled={isLoading}
                        />
                    )}
                    
                    <button 
                        className={`tailwind-toggle ${useTailwind ? 'active' : ''}`}
                        onClick={() => setUseTailwind(!useTailwind)}
                        title="Toggle Tailwind CSS"
                    >
                        {useTailwind ? 'Tailwind ON' : 'CSS Only'}
                    </button>
                </div>
            </div>
            
            <div className="nav-center">
                <h2 className="nav-logo">Flash UI</h2>
            </div>

            <div className="nav-right">
                <a href="https://x.com/ammaar" target="_blank" rel="noreferrer" className={`creator-credit ${hasStarted ? 'hide-on-mobile' : ''}`}>
                    created by @ammaar
                </a>
            </div>
        </header>
    );
};

export default TopNavBar;
