import React, { useState, useEffect } from 'react';
import { Skill } from '../types';
import { TrashIcon, MagicWandIcon, ZapIcon, DownloadIcon } from './Icons';

interface SkillsManagerProps {
    skills: Skill[];
    onUpdateSkills: (skills: Skill[]) => void;
}

export default function SkillsManager({ skills, onUpdateSkills }: SkillsManagerProps) {
    const [newSkillName, setNewSkillName] = useState('');
    const [newSkillDesc, setNewSkillDesc] = useState('');
    const [librarySkills, setLibrarySkills] = useState<Skill[]>([]);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [isLibraryLoading, setIsLibraryLoading] = useState(false);
    const [libraryError, setLibraryError] = useState('');
    const [nameError, setNameError] = useState('');

    useEffect(() => {
        setIsLibraryLoading(true);
        setLibraryError('');
        fetch('skill/manifest.json')
            .then(res => {
                if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) setLibrarySkills(data);
                else throw new Error('Invalid manifest format');
            })
            .catch(err => {
                setLibraryError(err.message);
                setLibrarySkills([]);
            })
            .finally(() => setIsLibraryLoading(false));
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

    const inputStyle: React.CSSProperties = {
        background: 'var(--bg-color)',
        border: '1px solid var(--border-color)',
        color: 'var(--text-primary)',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '0.9rem',
        fontFamily: 'var(--font-sans)',
        outline: 'none',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {activeCount} active skill{activeCount !== 1 ? 's' : ''} powering generation
                </div>
                <button
                    onClick={() => setIsLibraryOpen(!isLibraryOpen)}
                    style={{
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
                    }}
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
                            {librarySkills.filter(ls => !skills.some(s => s.id === ls.id)).length === 0 && (
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>All library skills already added.</p>
                            )}
                            {librarySkills.filter(ls => !skills.some(s => s.id === ls.id)).map(libSkill => (
                                <div key={libSkill.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--bg-color)', padding: '10px', borderRadius: '8px', gap: '10px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{libSkill.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{libSkill.description}</div>
                                    </div>
                                    <button
                                        onClick={() => addFromLibrary(libSkill)}
                                        style={{
                                            background: '#a855f7',
                                            color: 'white',
                                            border: 'none',
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            whiteSpace: 'nowrap'
                                        }}
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
                    placeholder="Skill Name (e.g. Minimalist Expert)"
                    value={newSkillName}
                    onChange={(e) => { setNewSkillName(e.target.value); setNameError(''); }}
                    style={inputStyle}
                />
                {nameError && (
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#ff6b6b' }}>{nameError}</p>
                )}
                <textarea
                    placeholder="Skill Context (Instructions for the AI...)"
                    value={newSkillDesc}
                    onChange={(e) => setNewSkillDesc(e.target.value)}
                    style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' } as React.CSSProperties}
                />
                <button
                    onClick={handleAddSkill}
                    disabled={!newSkillName.trim() || !newSkillDesc.trim()}
                    style={{
                        background: (!newSkillName.trim() || !newSkillDesc.trim()) ? 'var(--border-color)' : '#a855f7',
                        color: 'white',
                        border: 'none',
                        padding: '10px',
                        borderRadius: '8px',
                        cursor: (!newSkillName.trim() || !newSkillDesc.trim()) ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
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
                        onClick={() => toggleSkill(skill.id)}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            background: skill.isActive ? 'var(--surface-color-hover)' : 'var(--surface-color)',
                            border: `1px solid ${skill.isActive ? '#a855f7' : 'var(--border-color)'}`,
                            padding: '12px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            opacity: skill.isActive ? 1 : 0.6,
                            transition: 'all 0.2s',
                            position: 'relative'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                                {skill.isActive ? <ZapIcon /> : null}
                                {skill.name}
                            </h4>
                            <button
                                onClick={(e) => deleteSkill(skill.id, e)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                title="Delete skill"
                            >
                                <TrashIcon />
                            </button>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {skill.description}
                        </p>
                        {skill.isActive && (
                            <div style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#a855f7', color: 'white', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                                ✓
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
