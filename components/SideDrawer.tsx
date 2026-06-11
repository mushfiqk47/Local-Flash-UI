import React, { useEffect } from 'react';

interface SideDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children?: React.ReactNode;
    className?: string;
    action?: React.ReactNode;
}

const SideDrawer = ({ isOpen, onClose, title, children, className = '', action }: SideDrawerProps) => {
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="drawer-overlay" onClick={onClose}>
            <div className={`drawer-content ${className}`} onClick={(e) => e.stopPropagation()}>
                <div className="drawer-header">
                    <h2>{title}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {action}
                        <button onClick={onClose} className="close-button">&times;</button>
                    </div>
                </div>
                <div className="drawer-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default SideDrawer;
