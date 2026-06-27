import { AnimatePresence, motion } from "framer-motion";
import type { ToastItem } from "../hooks/useToast";

interface ToastProps {
    toasts: ToastItem[];
}

const toastColors: Record<ToastItem["type"], string> = {
    leave: "#ff4d4d",
    host:  "#f5c518",
    info:  "#ffffff",
};

const Toast = ({ toasts }: ToastProps) => {
    return (
        <div style={{
            position: "fixed",
            top: "16px",
            right: "16px",
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            pointerEvents: "none",
        }}>
            <AnimatePresence>
                {toasts.map(toast => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, x: 60 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 60 }}
                        transition={{ duration: 0.22 }}
                        style={{
                            background: "#10101f",
                            border: `2px solid ${toastColors[toast.type]}`,
                            color: toastColors[toast.type],
                            fontFamily: "'Press Start 2P', monospace",
                            fontSize: "8px",
                            padding: "10px 14px",
                            letterSpacing: "1px",
                            lineHeight: "1.6",
                            maxWidth: "240px",
                            boxShadow: `4px 4px 0px ${toast.type === "host" ? "#a88510" : "#991f1f"}`,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                        }}
                    >
                        {toast.type === "leave" && "✕ "}
                        {toast.type === "host"  && "★ "}
                        {toast.message}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default Toast;