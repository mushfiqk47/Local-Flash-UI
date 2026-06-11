import React from 'react';
import { BrainIcon } from './Icons';

interface SkillsToggleButtonProps {
    onClick: () => void;
}

const SkillsToggleButton = React.memo(({ onClick }: SkillsToggleButtonProps) => (
    <button 
        type="button"
        className="skills-toggle" 
        onClick={onClick} 
        title="Manage AI Skills"
    >
        <BrainIcon />
        <span>Skills</span>
    </button>
));

export default SkillsToggleButton;
