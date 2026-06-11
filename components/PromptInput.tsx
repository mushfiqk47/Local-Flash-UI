
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useEffect } from 'react';
import { ImageIcon, XIcon, ThinkingIcon, ArrowUpIcon, MagicWandIcon, ZapIcon } from './Icons';
import { Skill } from '../types';

const EMPTY_SKILLS: Skill[] = [];

interface PromptInputProps {
    inputValue: string;
    setInputValue: (val: string) => void;
    selectedImage: string | null;
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveImage: (e: React.MouseEvent) => void;
    isLoading: boolean;
    currentPlaceholder: string;
    generatingPrompt?: string;
    onSendMessage: () => void;
    isImproving?: boolean;
    onCancelImprove?: () => void;
    activeSkills?: Skill[];
}

const PromptInput: React.FC<PromptInputProps> = ({
    inputValue,
    setInputValue,
    selectedImage,
    onImageUpload,
    onRemoveImage,
    isLoading,
    currentPlaceholder,
    generatingPrompt,
    onSendMessage,
    isImproving,
    onCancelImprove,
    activeSkills = EMPTY_SKILLS
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);



    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !isLoading) {
            event.preventDefault();
            onSendMessage();
        } else if (event.key === 'Tab' && !inputValue && !isLoading) {
            event.preventDefault();
            setInputValue(currentPlaceholder);
        } else if (event.key === 'Escape' && isImproving && onCancelImprove) {
            onCancelImprove();
        }
    };

    return (
        <div className="floating-input-container">
            {activeSkills.length > 0 && !isLoading && (
                <div className="active-skills-row">
                    {activeSkills.map(skill => (
                        <span key={skill.id} className="active-skill-tag">{skill.name}</span>
                    ))}
                </div>
            )}
            <div className={`input-wrapper ${isLoading ? 'loading' : ''} ${selectedImage ? 'has-image' : ''} ${isImproving ? 'improving' : ''}`}>
                {isImproving ? (
                    <button 
                        type="button"
                        className="upload-button"
                        onClick={onCancelImprove}
                        title="Cancel Improvement"
                        style={{ color: '#a855f7' }}
                    >
                        <XIcon />
                    </button>
                ) : (
                    <button 
                        type="button"
                        className="upload-button" 
                        onClick={() => fileInputRef.current?.click()} 
                        title="Upload Image"
                        aria-label="Upload Image"
                        disabled={isLoading}
                    >
                        <ImageIcon />
                    </button>
                )}
                
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{display: 'none'}} 
                    accept="image/*" 
                    onChange={onImageUpload}
                    aria-hidden="true"
                    tabIndex={-1}
                />
                
                {selectedImage && !isImproving && (
                    <div className="image-preview-badge">
                        <img src={selectedImage} alt="Preview" />
                        <button type="button" className="remove-image-btn" onClick={onRemoveImage} aria-label="Remove image">
                            <XIcon />
                        </button>
                    </div>
                )}

                {(!inputValue && !isLoading) && (
                    <div className="animated-placeholder">
                        <span className="placeholder-text">
                            {isImproving ? "Describe how to improve this design..." : currentPlaceholder}
                        </span>
                        {!isImproving && <span className="tab-hint">Tab</span>}
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
                        aria-label={isImproving ? "Improvement instruction" : "Prompt input"}
                    />
                ) : (
                    <div className="input-generating-label">
                        <span className="generating-prompt-text">{generatingPrompt}</span>
                        <ThinkingIcon />
                    </div>
                )}
                
                <button 
                    type="button"
                    className="send-button" 
                    onClick={onSendMessage} 
                    disabled={isLoading || (!inputValue.trim() && !selectedImage)}
                    aria-label={isImproving ? "Improve" : "Generate"}
                    style={isImproving ? { background: '#a855f7' } : {}}
                >
                    {isImproving ? <MagicWandIcon /> : <ArrowUpIcon />}
                </button>
            </div>
        </div>
    );
};

export default PromptInput;
