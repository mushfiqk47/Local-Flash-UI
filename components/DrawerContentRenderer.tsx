import React from 'react';
import { ComponentVariation, Session, Skill } from '../types';
import { ThinkingIcon, TrashIcon } from './Icons';
import SkillsManager from './SkillsManager';
import PromptInput from './PromptInput';

interface DrawerContentRendererProps {
    drawerMode: 'code' | 'variations' | 'full-page' | 'history' | 'skills' | null;
    drawerData: any;
    isLoadingDrawer: boolean;
    componentVariations: ComponentVariation[];
    sessions: Session[];
    currentSessionIndex: number;
    skills: Skill[];
    fullPageInputValue: string;
    isFullPageImproving: boolean;
    isLoading: boolean;
    applyVariation: (html: string) => void;
    handleRestoreSession: (index: number) => void;
    handleDeleteSession: (index: number, e: React.MouseEvent) => void;
    handleClearHistory: () => void;
    setSkills: (skills: Skill[]) => void;
    setFullPageInputValue: (val: string) => void;
    setIsFullPageImproving: (val: boolean) => void;
    handleImproveFullPage: () => void;
}

const DrawerContentRenderer = React.memo(({
    drawerMode,
    drawerData,
    isLoadingDrawer,
    componentVariations,
    sessions,
    currentSessionIndex,
    skills,
    fullPageInputValue,
    isFullPageImproving,
    isLoading,
    applyVariation,
    handleRestoreSession,
    handleDeleteSession,
    handleClearHistory,
    setSkills,
    setFullPageInputValue,
    setIsFullPageImproving,
    handleImproveFullPage
}: DrawerContentRendererProps) => {
    if (isLoadingDrawer) {
        return (
             <div className="loading-state">
                 <ThinkingIcon /> 
                 {drawerMode === 'full-page' ? 'Building homepage...' : 'Designing variations...'}
             </div>
        );
    }

    if (drawerMode === 'code') {
        return <pre className="code-block"><code>{drawerData}</code></pre>;
    }

    if (drawerMode === 'variations') {
        return (
            <div className="sexy-grid">
                 {componentVariations.map((v) => (
                      <button 
                          key={v.name} 
                          type="button"
                          className="sexy-card" 
                          onClick={() => applyVariation(v.html)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') applyVariation(v.html); }}
                      >
                          <div className="sexy-preview">
                              <iframe srcDoc={v.html} title={v.name} sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation" />
                          </div>
                          <div className="sexy-label">{v.name}</div>
                      </button>
                 ))}
             </div>
        );
    }

    if (drawerMode === 'history') {
        return (
            <div className="history-list">
                {sessions.length === 0 && (
                    <div style={{textAlign:'center', color: '#666', marginTop: '20px'}}>No history yet.</div>
                )}
                {sessions.slice().reverse().map((session, i) => {
                     const originalIndex = sessions.length - 1 - i;
                     return (
                          <div 
                              key={session.id} 
                              className={`history-item ${originalIndex === currentSessionIndex ? 'active' : ''}`} 
                          >
                              <button 
                                  type="button" 
                                  className="history-info-btn"
                                  onClick={() => handleRestoreSession(originalIndex)}
                              >
                                  <div className="history-info">
                                      <div className="history-prompt">{session.prompt}</div>
                                      <div className="history-meta">{new Date(session.timestamp).toLocaleTimeString()}</div>
                                  </div>
                              </button>
                              <div className="history-actions">
                                  <button type="button" onClick={(e) => handleDeleteSession(originalIndex, e)} title="Delete session">
                                      <TrashIcon />
                                  </button>
                              </div>
                          </div>
                     );
                })}
                {sessions.length > 0 && (
                    <button type="button" className="clear-history-btn" onClick={handleClearHistory}>
                        Clear All History
                    </button>
                )}
            </div>
        );
    }

    if (drawerMode === 'skills') {
        return <SkillsManager skills={skills} onUpdateSkills={setSkills} />;
    }

    if (drawerMode === 'full-page') {
        return (
            <>
                {drawerData && (
                    <iframe 
                        srcDoc={drawerData} 
                        title="Full Page Preview" 
                        className="full-page-frame"
                        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation" 
                    />
                )}
                {isFullPageImproving && (
                     <PromptInput 
                         inputValue={fullPageInputValue}
                         setInputValue={setFullPageInputValue}
                         selectedImage={null}
                         onImageUpload={() => {}}
                         onRemoveImage={(e) => {e.preventDefault()}}
                         isLoading={isLoading}
                         currentPlaceholder="How should we improve this page?"
                         onSendMessage={handleImproveFullPage}
                         isImproving={true}
                         onCancelImprove={() => setIsFullPageImproving(false)}
                         activeSkills={skills.filter(s => s.isActive)}
                     />
                )}
            </>
        );
    }

    return null;
});

export default DrawerContentRenderer;
