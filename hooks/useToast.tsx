import React, { useState, useCallback } from 'react';

export function useToast() {
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

    const showToast = useCallback((message: string, type: 'error' | 'success' = 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const ToastComponent = () => (
        toast ? (
            <div className={`toast-notification ${toast.type}`}>
                {toast.message}
            </div>
        ) : null
    );

    return { showToast, ToastComponent };
}
