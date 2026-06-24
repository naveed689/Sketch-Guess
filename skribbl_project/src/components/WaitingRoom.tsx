import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type Player, type Room, type RoomSettings, type WaitingRoomProps } from "../types";
import "./waitingRoom.css";

const WaitingRoom = ({ socket, roomData, setRoomData, setScreen, playerName }: WaitingRoomProps) => {
    const [players, setPlayers] = useState<Player[]>([]);
    const [isHost, setIsHost] = useState<boolean>(false);
    const [settings, setSettings] = useState<RoomSettings>({ rounds: 3, drawTime: 80, maxPlayers: 8 });
    const [confirmKick, setConfirmKick] = useState<Player | null>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [notEnoughError, setNotEnoughError] = useState<boolean>(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState<boolean>(false);

    const handleStartGame = () => {
        if (!isHost) return;
        socket.emit('startGame', { roomCode: roomData!.code });
    };

    const handleSettingChange = (key: keyof RoomSettings, value: string) => {
        const updated = { ...settings, [key]: Number(value) };
        setSettings(updated);
        socket.emit('updateSettings', { roomCode: roomData!.code, settings: updated });
    };

    const handleKick = (playerId: string) => {
        socket.emit('kickPlayer', { roomCode: roomData!.code, playerId });
        setConfirmKick(null);
    };

    useEffect(() => {
        socket.on('gameStarted', (data: Room) => {
            setRoomData(prev => ({ ...prev, ...data, gamePhase: 'selecting' }));
            setScreen('game');
        });
        socket.on('roomUpdated', (room: Room) => {
            setRoomData(room);
        });
        socket.on('kicked', () => {
            setScreen('lobby');
            setRoomData(null);
        });
        socket.on('playersUpdated', (updatedPlayers: Player[]) => {
            setPlayers(updatedPlayers);
            const currentPlayer = updatedPlayers.find(p => p.name === playerName);
            setIsHost(currentPlayer?.isHost || false);
        });
        socket.on('notEnoughPlayers', () => {
            setNotEnoughError(true);
            setTimeout(() => setNotEnoughError(false), 2500);
        });
        return () => {
            socket.off('gameStarted');
            socket.off('roomUpdated');
            socket.off('kicked');
            socket.off('notEnoughPlayers');
            socket.off('playersUpdated');
        };
    }, []);

    useEffect(() => {
        if (!roomData) return;
        setPlayers(roomData.players);
        setSettings(roomData.settings);
        const currentPlayer = roomData.players.find(p => p.name === playerName);
        setIsHost(currentPlayer?.isHost || false);
    }, [roomData, playerName]);

    // animation variants
    const pageVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.3 } },
        exit: { opacity: 0, transition: { duration: 0.25 } }
    };

    const headerVariants = {
        hidden: { y: -60, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { duration: 0.45, ease: "easeOut" as const } },
        exit: { y: -60, opacity: 0, transition: { duration: 0.3 } }
    };

    const leftVariants = {
        hidden: { x: -80, opacity: 0 },
        visible: { x: 0, opacity: 1, transition: { duration: 0.45, ease: "easeOut" as const, delay: 0.15 } },
        exit: { x: -80, opacity: 0, transition: { duration: 0.3 } }
    };

    const rightVariants = {
        hidden: { x: 80, opacity: 0 },
        visible: { x: 0, opacity: 1, transition: { duration: 0.45, ease: "easeOut" as const, delay: 0.15 } },
        exit: { x: 80, opacity: 0, transition: { duration: 0.3 } }
    };

    const bottomVariants = {
        hidden: { y: 60, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { duration: 0.45, ease: "easeOut" as const, delay: 0.28 } },
        exit: { y: 60, opacity: 0, transition: { duration: 0.3 } }
    };

    const modalVariants = {
        hidden: { scale: 0.8, opacity: 0 },
        visible: { scale: 1, opacity: 1, transition: { duration: 0.2 } },
        exit: { scale: 0.8, opacity: 0, transition: { duration: 0.15 } }
    };

    return (
        <motion.div
            className="wr-page"
            variants={pageVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
        >
            <div className="scanlines" />

            {/* Header */}
            <motion.div className="wr-header" variants={headerVariants} initial="hidden" animate="visible" exit="exit">
                <span className="wr-title-tag">▶ WAITING ROOM ◀</span>
                <div className="wr-room-code">
                    ROOM CODE: <span className="code-value">{roomData?.code}</span>
                </div>
                <div className="pixel-divider" />
            </motion.div>

            {/* Main content */}
            <div className="wr-body">

                {/* Players panel */}
                <motion.div className="wr-panel" variants={leftVariants} initial="hidden" animate="visible" exit="exit">
                    <div className="panel-title">▸ PLAYERS ({players.length}/{settings.maxPlayers})</div>
                    <div className="players-list">
                        <AnimatePresence>
                            {players.map((player) => (
                                <motion.div
                                    key={player.id}
                                    className="player-row"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                    onMouseEnter={() => setHoveredId(player.id)}
                                    onMouseLeave={() => setHoveredId(null)}
                                >
                                    <span className="player-crown">{player.isHost ? "♛" : "▸"}</span>
                                    <span className="player-name-wr">{player.name}</span>
                                    {player.isHost && <span className="host-badge">HOST</span>}
                                    {isHost && !player.isHost && hoveredId === player.id && (
                                        <motion.button
                                            className="kick-btn"
                                            onClick={() => setConfirmKick(player)}
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                        >
                                            ✕
                                        </motion.button>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* Settings panel */}
                <motion.div className="wr-panel" variants={rightVariants} initial="hidden" animate="visible" exit="exit">
                    <div className="panel-title">▸ SETTINGS</div>
                    <div className="settings-list">

                        <div className="setting-row">
                            <span className="setting-label">ROUNDS</span>
                            {isHost ? (
                                <select
                                    className="pixel-select"
                                    value={settings.rounds}
                                    onChange={e => handleSettingChange('rounds', e.target.value)}
                                >
                                    {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            ) : (
                                <span className="setting-value">{settings.rounds}</span>
                            )}
                        </div>

                        <div className="setting-row">
                            <span className="setting-label">DRAW TIME</span>
                            {isHost ? (
                                <select
                                    className="pixel-select"
                                    value={settings.drawTime}
                                    onChange={e => handleSettingChange('drawTime', e.target.value)}
                                >
                                    {[30, 60, 80, 120].map(n => <option key={n} value={n}>{n}s</option>)}
                                </select>
                            ) : (
                                <span className="setting-value">{settings.drawTime}s</span>
                            )}
                        </div>

                        <div className="setting-row">
                            <span className="setting-label">MAX PLAYERS</span>
                            {isHost ? (
                                <select
                                    className="pixel-select"
                                    value={settings.maxPlayers}
                                    onChange={e => handleSettingChange('maxPlayers', e.target.value)}
                                >
                                    {[2, 4, 6, 8].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            ) : (
                                <span className="setting-value">{settings.maxPlayers}</span>
                            )}
                        </div>

                    </div>
                </motion.div>
            </div>

            {/* Bottom action */}
            <motion.div className="wr-footer" variants={bottomVariants} initial="hidden" animate="visible" exit="exit">
                <AnimatePresence>
                    {notEnoughError && (
                        <motion.span
                            className="error-msg"
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                        >
                            ▸ NOT ENOUGH PLAYERS TO START
                        </motion.span>
                    )}
                </AnimatePresence>
                {isHost ? (
                    <button className="pixel-btn btn-start" onClick={handleStartGame}>▶ START GAME</button>
                ) : (
                    <div className="waiting-text">
                        <span className="blink-dot">■</span> WAITING FOR HOST TO START...
                    </div>
                )}
                <button className="wr-leave-btn" onClick={() => setShowLeaveConfirm(true)}>✕ LEAVE ROOM</button>
            </motion.div>

            {/* Leave confirm modal */}
            <AnimatePresence>
                {showLeaveConfirm && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={(e) => e.target === e.currentTarget && setShowLeaveConfirm(false)}
                    >
                        <motion.div
                            className="wr-modal-box"
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1, transition: { duration: 0.18 } }}
                            exit={{ scale: 0.85, opacity: 0, transition: { duration: 0.14 } }}
                        >
                            <div className="modal-title">▸ LEAVE ROOM?</div>
                            <div className="kick-name">You will be removed from the room.</div>
                            <div className="modal-btns">
                                <button className="btn-cancel" onClick={() => setShowLeaveConfirm(false)}>✕ STAY</button>
                                <button className="btn-kick-confirm" 
                                    onClick={() => { 
                                        // 1. Tell the server we are leaving
                                        socket.emit('leaveRoom', { roomCode: roomData.code }); 
                                        
                                        // 2. Clear local state and go to lobby
                                        setRoomData(null); 
                                        setScreen('lobby'); 
                                    }}>▶ LEAVE</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Kick modal */}
            <AnimatePresence>
                {confirmKick && (
                    <motion.div
                        className="wr-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={(e) => e.target === e.currentTarget && setConfirmKick(null)}
                    >
                        <motion.div
                            className="wr-modal-box"
                            variants={modalVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                        >
                            <div className="modal-title">▸ KICK PLAYER?</div>
                            <div className="kick-name">"{confirmKick.name}"</div>
                            <div className="modal-btns">
                                <button className="btn-cancel" onClick={() => setConfirmKick(null)}>✕ CANCEL</button>
                                <button className="btn-kick-confirm" onClick={() => handleKick(confirmKick.id)}>✕ KICK</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default WaitingRoom;