import React from 'react';
import ArtifactCard from './ArtifactCard';
import { SparklesIcon, ArrowLeftIcon, ArrowRightIcon } from './Icons';
import { Session } from '../types';

interface SessionStageProps {
    sessions: Session[];
    currentSessionIndex: number;
    focusedArtifactIndex: number | null;
    setFocusedArtifactIndex: (index: number | null) => void;
    isLoading: boolean;
    hasStarted: boolean;
    handleSurpriseMe: () => void;
    gridScrollRef: React.RefObject<HTMLDivElement>;
    navNext: () => void;
    navPrev: () => void;
    canGoBack: boolean;
    canGoForward: boolean;
}

const SessionStage: React.FC<SessionStageProps> = ({
    sessions,
    currentSessionIndex,
    focusedArtifactIndex,
    setFocusedArtifactIndex,
    isLoading,
    hasStarted,
    handleSurpriseMe,
    gridScrollRef,
    navNext,
    navPrev,
    canGoBack,
    canGoForward
}) => {
    return (
        <>
            <div className={`stage-container ${focusedArtifactIndex !== null ? 'mode-focus' : 'mode-split'}`}>
                 <div className={`empty-state ${hasStarted ? 'fade-out' : ''}`}>
                     <div className="empty-content">
                         <h1>Flash UI</h1>
                         <p>Creative UI generation in a flash</p>
                         <button className="surprise-button" onClick={handleSurpriseMe} disabled={isLoading}>
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
                                            onClick={() => setFocusedArtifactIndex(aIndex)}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

             {canGoBack && (
                <button className="nav-handle left" onClick={navPrev} aria-label="Previous">
                    <ArrowLeftIcon />
                </button>
             )}
             {canGoForward && (
                <button className="nav-handle right" onClick={navNext} aria-label="Next">
                    <ArrowRightIcon />
                </button>
             )}
        </>
    );
};

export default SessionStage;
