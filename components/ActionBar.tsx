
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { 
    UndoIcon, RedoIcon, GridIcon, SparklesIcon, LayoutIcon, 
    DownloadIcon, CodeIcon, HistoryIcon, CopyIcon, MagicWandIcon
} from './Icons';

interface ActionBarProps {
    isVisible: boolean;
    currentPrompt?: string;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onClearFocus: () => void;
    onGenerateVariations: () => void;
    onGenerateFullPage: () => void;
    onDownload: () => void;
    onShowCode: () => void;
    onShowHistory: () => void;
    onDuplicate: () => void;
    onImprove: () => void;
    isLoading: boolean;
}

const ActionBar: React.FC<ActionBarProps> = ({
    isVisible,
    currentPrompt,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onClearFocus,
    onGenerateVariations,
    onGenerateFullPage,
    onDownload,
    onShowCode,
    onShowHistory,
    onDuplicate,
    onImprove,
    isLoading
}) => {
    return (
        <div className={`action-bar ${isVisible ? 'visible' : ''}`} role="toolbar" aria-label="Editor actions">
             <div className="active-prompt-label" title={currentPrompt}>
                {currentPrompt}
             </div>
             <div className="action-buttons">
                <button onClick={onUndo} disabled={!canUndo} title="Undo" aria-label="Undo">
                    <UndoIcon />
                </button>
                <button onClick={onRedo} disabled={!canRedo} title="Redo" aria-label="Redo">
                    <RedoIcon />
                </button>

                <div className="separator" aria-hidden="true" />

                <button onClick={onClearFocus} aria-label="Grid View">
                    <GridIcon /> Grid View
                </button>
                <button onClick={onDuplicate} disabled={isLoading} aria-label="Duplicate Design">
                    <CopyIcon /> Duplicate
                </button>
                <button onClick={onImprove} disabled={isLoading} aria-label="Improve Design">
                    <MagicWandIcon /> Improve
                </button>
                <button onClick={onGenerateVariations} disabled={isLoading} aria-label="Generate Variations">
                    <SparklesIcon /> Variations
                </button>
                <button onClick={onGenerateFullPage} disabled={isLoading} aria-label="Generate Full Homepage">
                    <LayoutIcon /> Full Homepage
                </button>
                <button onClick={onDownload} disabled={isLoading} title="Download Source" aria-label="Export HTML">
                    <DownloadIcon /> Export
                </button>
                <button onClick={onShowCode} aria-label="View Source Code">
                    <CodeIcon /> Source
                </button>

                <div className="separator" aria-hidden="true" />

                <button onClick={onShowHistory} title="History" aria-label="View History">
                    <HistoryIcon />
                </button>
             </div>
        </div>
    );
};

export default ActionBar;
