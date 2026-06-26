import { useState } from "react";

export type ToastType = "leave" | "host" | "info";

export interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

const useToast = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = (message: string, type: ToastType = "info") => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    return { toasts, addToast };
};

export default useToast;