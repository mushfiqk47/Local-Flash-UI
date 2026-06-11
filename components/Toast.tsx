import React, { useEffect } from 'react';

export interface ToastMessage {
    id: string;
    text: string;
    type: 'success' | 'error' | 'info';
}

interface ToastContainerProps {
    toasts: ToastMessage[];
    onDismiss: (id: string) => void;
    onAdd: (toast: ToastMessage) => void;
}

export function useToast() {
    const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

    const addToast = React.useCallback((text: string, type: ToastMessage['type'] = 'info') => {
        const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        setToasts(prev => [...prev, { id, text, type }]);
    }, []);

    const dismissToast = React.useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return { toasts, addToast, dismissToast };
}

const TOAST_ITEM_BASE_STYLE: React.CSSProperties = {
    color: '#fff',
    padding: '10px 16px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    fontWeight: 500,
    backdropFilter: 'blur(8px)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    animation: 'toastSlideIn 0.3s ease-out',
    pointerEvents: 'auto',
    maxWidth: '360px',
    wordBreak: 'break-word',
};

const TOAST_BUTTON_STYLE: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    padding: '0',
    fontSize: '1.1rem',
    lineHeight: 1,
    opacity: 0.7,
};

const TOAST_CONTAINER_STYLE: React.CSSProperties = {
    position: 'fixed',
    bottom: '100px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 300,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    pointerEvents: 'none',
    alignItems: 'center',
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => onDismiss(toast.id), 3500);
        return () => clearTimeout(timer);
    }, [toast.id, onDismiss]);

    const bgColor = toast.type === 'error' ? 'rgba(239, 68, 68, 0.9)'
        : toast.type === 'success' ? 'rgba(34, 197, 94, 0.9)'
        : 'rgba(39, 39, 42, 0.95)';

    return (
        <div
            style={{
                ...TOAST_ITEM_BASE_STYLE,
                background: bgColor,
            }}
            role="alert"
        >
            <span style={{ flex: 1 }}>{toast.text}</span>
            <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                style={TOAST_BUTTON_STYLE}
                aria-label="Dismiss"
            >
                &times;
            </button>
        </div>
    );
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
    if (toasts.length === 0) return null;

    return (
        <div style={TOAST_CONTAINER_STYLE}>
            {toasts.map(t => (
                <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
            ))}
        </div>
    );
};
