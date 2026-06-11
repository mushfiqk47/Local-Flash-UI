import React from 'react';
import { LLMProviderId, LLM_PROVIDERS } from '../types';
import { BrainIcon, ZapIcon, DiamondIcon } from './Icons';

interface ModelToggleButtonProps {
    activeProvider: LLMProviderId;
    toggleModel: () => void;
}

const ModelToggleButton = React.memo(({ activeProvider, toggleModel }: ModelToggleButtonProps) => {
    const nextProviderIndex = (LLM_PROVIDERS.findIndex(p => p.id === activeProvider) + 1) % LLM_PROVIDERS.length;
    const nextProviderLabel = LLM_PROVIDERS[nextProviderIndex].label;
    const currentLabel = LLM_PROVIDERS.find(p => p.id === activeProvider)?.label || activeProvider;
    
    return (
        <button 
            type="button"
            className="model-toggle" 
            onClick={toggleModel} 
            title={`Switch to ${nextProviderLabel}`}
            aria-label={`Current provider: ${activeProvider}`}
        >
            {activeProvider === 'ollama' || activeProvider === 'lm-studio' ? <BrainIcon /> : (activeProvider === 'gemini-flash' ? <ZapIcon /> : <DiamondIcon />)}
            <span>{currentLabel}</span>
        </button>
    );
});

export default ModelToggleButton;
