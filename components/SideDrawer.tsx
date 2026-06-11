import React, { useEffect, useRef } from 'react';

interface SideDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children?: React.ReactNode;
    className?: string;
    action?: React.ReactNode;
}

const SideDrawer = ({ isOpen, onClose, title, children, className = '', action }: SideDrawerProps) => {
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    });

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCloseRef.current();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <>
            <button 
                type="button"
                className="drawer-overlay" 
                onClick={onClose}
                tabIndex={-1}
                aria-label="Close drawer"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
            />
            <div className={`drawer-content ${className}`} onClick={(e) => e.stopPropagation()}>
                <div className="drawer-header">
                    <h2>{title}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {action}
                        <button type="button" onClick={onClose} className="close-button">&times;</button>
                    </div>
                </div>
                <div className="drawer-body">
                    {children}
                </div>
            </div>
        </>
    );
};

export default SideDrawer;
