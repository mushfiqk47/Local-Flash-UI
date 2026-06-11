import React, { useState, useEffect } from 'react';
import { Skill } from '../types';
import { TrashIcon, MagicWandIcon, ZapIcon, DownloadIcon } from './Icons';

interface SkillsManagerProps {
    skills: Skill[];
    onUpdateSkills: (skills: Skill[]) => void;
}

const INPUT_STYLE: React.CSSProperties = {
    background: 'var(--bg-color)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    padding: '10px',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
};

const LIBRARY_BUTTON_STYLE: React.CSSProperties = {
    background: 'rgba(168, 85, 247, 0.1)',
    color: '#a855f7',
    border: '1px solid rgba(168, 85, 247, 0.2)',
    padding: '6px 12px',
    borderRadius: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.85rem',
    fontWeight: 600
};

const ADD_LIBRARY_BUTTON_STYLE: React.CSSProperties = {
    background: '#a855f7',
    color: 'white',
    border: 'none',
    padding: '4px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap'
};

const ADD_CUSTOM_SKILL_BASE_STYLE: React.CSSProperties = {
    color: 'white',
    border: 'none',
    padding: '10px',
    borderRadius: '8px',
    fontWeight: 600,
};

const ACTIVE_CHECKMARK_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '-5px',
    right: '-5px',
    background: '#a855f7',
    color: 'white',
    borderRadius: '50%',
    width: '18px',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 'bold'
};

async function fetchManifest(): Promise<Skill[]> {
    const res = await fetch('skill/manifest.json');
    if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Invalid manifest format');
    return data;
}

export default function SkillsManager({ skills, onUpdateSkills }: SkillsManagerProps) {
    const [state, setState] = useState({
        newSkillName: '',
        newSkillDesc: '',
        librarySkills: [] as Skill[],
        isLibraryOpen: false,
        isLibraryLoading: true,
        libraryError: '',
        nameError: '',
    });
    const { newSkillName, newSkillDesc, librarySkills, isLibraryOpen, isLibraryLoading, libraryError, nameError } = state;

    const setNewSkillName = (val: string) => setState(prev => ({ ...prev, newSkillName: val }));
    const setNewSkillDesc = (val: string) => setState(prev => ({ ...prev, newSkillDesc: val }));
    const setLibrarySkills = (val: Skill[]) => setState(prev => ({ ...prev, librarySkills: val }));
    const setIsLibraryOpen = (val: boolean) => setState(prev => ({ ...prev, isLibraryOpen: val }));
    const setIsLibraryLoading = (val: boolean) => setState(prev => ({ ...prev, isLibraryLoading: val }));
    const setLibraryError = (val: string) => setState(prev => ({ ...prev, libraryError: val }));
    const setNameError = (val: string) => setState(prev => ({ ...prev, nameError: val }));

    useEffect(() => {
        let active = true;
        fetchManifest()
            .then(data => {
                if (active) setState(prev => ({ ...prev, librarySkills: data }));
            })
            .catch(err => {
                if (active) setState(prev => ({ ...prev, libraryError: err.message, librarySkills: [] }));
            })
            .finally(() => {
                if (active) setState(prev => ({ ...prev, isLibraryLoading: false }));
            });
        return () => {
            active = false;
        };
    }, []);

    const handleAddSkill = () => {
        const name = newSkillName.trim();
        const desc = newSkillDesc.trim();
        if (!name || !desc) return;

        if (skills.some(s => s.name.toLowerCase() === name.toLowerCase())) {
            setNameError('A skill with this name already exists');
            return;
        }
        setNameError('');

        const newSkill: Skill = {
            id: Date.now().toString(),
            name,
            description: desc,
            isActive: true
        };
        onUpdateSkills([...skills, newSkill]);
        setNewSkillName('');
        setNewSkillDesc('');
    };

    const addFromLibrary = (libSkill: Skill) => {
        if (skills.some(s => s.id === libSkill.id)) return;
        if (skills.some(s => s.name.toLowerCase() === libSkill.name.toLowerCase())) return;
        onUpdateSkills([...skills, { ...libSkill, isActive: true }]);
    };

    const toggleSkill = (id: string) => {
        onUpdateSkills(skills.map(s =>
            s.id === id ? { ...s, isActive: !s.isActive } : s
        ));
    };

    const deleteSkill = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdateSkills(skills.filter(s => s.id !== id));
    };

    const activeCount = skills.filter(s => s.isActive).length;
    const availableLibrarySkills = librarySkills.filter(ls => !skills.some(s => s.id === ls.id));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {activeCount} active skill{activeCount !== 1 ? 's' : ''} powering generation
                </div>
                <button
                    type="button"
                    onClick={() => setIsLibraryOpen(!isLibraryOpen)}
                    style={LIBRARY_BUTTON_STYLE}
                >
                    <DownloadIcon /> Library
                </button>
            </div>

            {isLibraryOpen && (
                <div style={{ background: 'var(--surface-color)', padding: '15px', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                        <DownloadIcon /> Available in Library
                    </h3>
                    {isLibraryLoading && (
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading skills...</p>
                    )}
                    {libraryError && (
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#ff6b6b' }}>Error: {libraryError}</p>
                    )}
                    {!isLibraryLoading && !libraryError && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {availableLibrarySkills.length === 0 && (
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>All library skills already added.</p>
                            )}
                            {availableLibrarySkills.map(libSkill => (
                                <div key={libSkill.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--bg-color)', padding: '10px', borderRadius: '8px', gap: '10px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{libSkill.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{libSkill.description}</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => addFromLibrary(libSkill)}
                                        style={ADD_LIBRARY_BUTTON_STYLE}
                                    >
                                        Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--surface-color)', padding: '15px', borderRadius: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Create Custom Skill</h3>
                <input
                    type="text"
                    aria-label="Skill Name"
                    placeholder="Skill Name (e.g. Minimalist Expert)"
                    value={newSkillName}
                    onChange={(e) => { setNewSkillName(e.target.value); setNameError(''); }}
                    style={INPUT_STYLE}
                />
                {nameError && (
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#ff6b6b' }}>{nameError}</p>
                )}
                <textarea
                    aria-label="Skill Description"
                    placeholder="Skill Context (Instructions for the AI...)"
                    value={newSkillDesc}
                    onChange={(e) => setNewSkillDesc(e.target.value)}
                    style={{ ...INPUT_STYLE, minHeight: '80px', resize: 'vertical' } as React.CSSProperties}
                />
                <button
                    type="button"
                    onClick={handleAddSkill}
                    disabled={!newSkillName.trim() || !newSkillDesc.trim()}
                    style={{
                        ...ADD_CUSTOM_SKILL_BASE_STYLE,
                        background: (!newSkillName.trim() || !newSkillDesc.trim()) ? 'var(--border-color)' : '#a855f7',
                        cursor: (!newSkillName.trim() || !newSkillDesc.trim()) ? 'not-allowed' : 'pointer',
                        opacity: (!newSkillName.trim() || !newSkillDesc.trim()) ? 0.5 : 1
                    }}
                >
                    Add Skill
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {skills.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No skills attached yet.</p>}
                {skills.map(skill => (
                    <div
                        key={skill.id}
                        className={`skill-card ${skill.isActive ? 'active' : ''}`}
                    >
                        <button
                            type="button"
                            onClick={() => toggleSkill(skill.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSkill(skill.id); }}
                            className="skill-card-inner-btn"
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                                    {skill.isActive ? <ZapIcon /> : null}
                                    {skill.name}
                                </h4>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {skill.description}
                            </p>
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={(e) => deleteSkill(skill.id, e)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                title="Delete skill"
                            >
                                <TrashIcon />
                            </button>
                            {skill.isActive && (
                                <div style={ACTIVE_CHECKMARK_STYLE}>
                                    ✓
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
