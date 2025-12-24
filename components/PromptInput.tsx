import React, { useRef, useEffect } from 'react';
import { ThinkingIcon, ArrowUpIcon } from './Icons';

interface PromptInputProps {
    inputValue: string;
    setInputValue: (v: string) => void;
    isLoading: boolean;
    placeholders: string[];
    placeholderIndex: number;
    currentPrompt?: string;
    onSend: (manualPrompt?: string) => void;
}

const PromptInput: React.FC<PromptInputProps> = ({
    inputValue,
    setInputValue,
    isLoading,
    placeholders,
    placeholderIndex,
    currentPrompt,
    onSend
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Re-focus after loading finishes
    useEffect(() => {
        if (!isLoading) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isLoading]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !isLoading) {
            event.preventDefault();
            onSend();
        } else if (event.key === 'Tab' && !inputValue && !isLoading) {
            event.preventDefault();
            setInputValue(placeholders[placeholderIndex]);
        }
    };

    return (
        <div className="floating-input-container">
            <div className={`input-wrapper ${isLoading ? 'loading' : ''}`}>
                {(!inputValue && !isLoading) && (
                    <div className="animated-placeholder" key={placeholderIndex}>
                        <span className="placeholder-text">{placeholders[placeholderIndex]}</span>
                        <span className="tab-hint">Tab</span>
                    </div>
                )}
                {!isLoading ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                    />
                ) : (
                    <div className="input-generating-label">
                        <span className="generating-prompt-text">{currentPrompt}</span>
                        <ThinkingIcon />
                    </div>
                )}
                <button 
                    className="send-button" 
                    onClick={() => onSend()} 
                    disabled={isLoading || !inputValue.trim()}
                >
                    <ArrowUpIcon />
                </button>
            </div>
        </div>
    );
};

export default PromptInput;
