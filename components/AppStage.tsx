import React from 'react';
import { Session } from '../types';
import ArtifactCard from './ArtifactCard';
import { SparklesIcon } from './Icons';

interface AppStageProps {
    hasStarted: boolean;
    sessions: Session[];
    currentSessionIndex: number;
    focusedArtifactIndex: number | null;
    isLoading: boolean;
    handleSurpriseMe: () => void;
    setFocusedIndexWithScroll: (index: number | null) => void;
    gridScrollRef: React.RefObject<HTMLDivElement | null>;
}

const AppStage = React.memo(({
    hasStarted,
    sessions,
    currentSessionIndex,
    focusedArtifactIndex,
    isLoading,
    handleSurpriseMe,
    setFocusedIndexWithScroll,
    gridScrollRef
}: AppStageProps) => {
    return (
        <div className={`stage-container ${focusedArtifactIndex !== null ? 'mode-focus' : 'mode-split'}`}>
             <div className={`empty-state ${hasStarted ? 'fade-out' : ''}`}>
                 <div className="empty-content">
                     <h1>Flash UI</h1>
                     <p>Creative UI generation in a flash</p>
                      <button type="button" className="surprise-button" onClick={handleSurpriseMe} disabled={isLoading}>
                          <SparklesIcon /> Surprise Me
                      </button>
                 </div>
             </div>

            {sessions.map((session, sIndex) => {
                let positionClass = 'hidden';
                if (sIndex === currentSessionIndex) positionClass = 'active-session';
                else if (sIndex < currentSessionIndex) positionClass = 'past-session';
                else if (sIndex > currentSessionIndex) positionClass = 'future-session';
                
                return (
                    <div key={session.id} className={`session-group ${positionClass}`}>
                        <div className="artifact-grid" ref={sIndex === currentSessionIndex ? gridScrollRef : null}>
                            {session.artifacts.map((artifact, aIndex) => {
                                const isFocused = focusedArtifactIndex === aIndex;
                                
                                return (
                                    <ArtifactCard 
                                        key={artifact.id}
                                        artifact={artifact}
                                        isFocused={isFocused}
                                        onClick={() => setFocusedIndexWithScroll(aIndex)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
});

export default AppStage;
