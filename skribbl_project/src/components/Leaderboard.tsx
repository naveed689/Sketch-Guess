import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type LeaderboardProps, type Player } from "../types";

const Leaderboard = ({ players, correctGuessers, isHost, onKick, panelTitle = "▸ SCORES", socketId = null, currentDrawer = null }: LeaderboardProps) => {
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [confirmKick, setConfirmKick] = useState<Player | null>(null);

    const sorted = [...players].sort((a, b) => b.score - a.score);

    const handleKickConfirm = () => {
        onKick(confirmKick!.id);
        setConfirmKick(null);
    };

    const modalVariants = {
        hidden: { scale: 0.85, opacity: 0 },
        visible: { scale: 1, opacity: 1, transition: { duration: 0.18 } },
        exit: { scale: 0.85, opacity: 0, transition: { duration: 0.14 } }
    };

    return (
        <>
            <div className="panel-title">{panelTitle}</div>

            <AnimatePresence>
                {sorted.map((player, index) => (
                    <motion.div
                        key={player.id}
                        className={`lb-card ${correctGuessers.has(player.name) ? 'lb-guessed' : ''}`}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.2, delay: index * 0.04 }}
                        onMouseEnter={() => setHoveredId(player.id)}
                        onMouseLeave={() => setHoveredId(null)}
                    >
                        <span className="lb-rank">#{index + 1}</span>
                        <span className="lb-name">{player.name}</span>
                        {socketId && player.id === socketId && (
                            <span className="lb-you-tag">YOU</span>
                        )}
                        {currentDrawer && player.id === currentDrawer && (
                            <span className="lb-drawer-tag">✏</span>
                        )}
                        <span className="lb-score">{player.score}</span>
                        {isHost && !player.isHost && (
                            <button
                                className="lb-kick-btn"
                                onClick={() => setConfirmKick(player)}
                            >
                                ✕
                            </button>
                        )}
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Kick confirm modal */}
            <AnimatePresence>
                {confirmKick && (
                    <motion.div
                        className="lb-kick-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={(e) => e.target === e.currentTarget && setConfirmKick(null)}
                    >
                        <motion.div
                            className="lb-kick-modal-box"
                            variants={modalVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                        >
                            <div className="modal-title">▸ KICK PLAYER?</div>
                            <div className="kick-name">"{confirmKick.name}"</div>
                            <div className="modal-btns">
                                <button className="btn-cancel" onClick={() => setConfirmKick(null)}>✕ CANCEL</button>
                                <button className="btn-kick-confirm" onClick={handleKickConfirm}>✕ KICK</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default Leaderboard;