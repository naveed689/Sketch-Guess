import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./lobby.css";

const Lobby = ({ socket, setScreen, setRoomData, setPlayerName }) => {
    const [name, setName] = useState("");
    const [roomCode, setRoomCode] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [nameError, setNameError] = useState("");
    const [roomError, setRoomError] = useState("");
    const pendingScreenSwitch = useRef(false);

    useEffect(() => {
        socket.on('roomCreated', () => {
            pendingScreenSwitch.current = true;
        });
        socket.on('roomJoined', () => {
            pendingScreenSwitch.current = true;
        });
        socket.on('roomUpdated', (room) => {
            setRoomData(room);
            if (pendingScreenSwitch.current) {
                pendingScreenSwitch.current = false;
                setScreen(room.status === "waiting" ? "waiting" : "game");
            }
        });
        socket.on('roomNotFound', () => {
            setRoomError("Room not found. Check the code and try again.");
        });
        socket.on('roomFull', () => {
            setRoomError("Room is full. Try another room.");
        });
        socket.on('nameTaken', () => {
            setRoomError("Name already taken in that room.");
        });
        return () => {
            socket.off('roomCreated');
            socket.off('roomJoined');
            socket.off('roomNotFound');
            socket.off('roomFull');
            socket.off('roomUpdated');
            socket.off('nameTaken');
        };
    }, []);

    const handleCreateRoom = () => {
        if (!name.trim()) {
            setNameError("Name required to create a room.");
            return;
        }
        setNameError("");
        setPlayerName(name.trim());
        socket.emit('createRoom', { name: name.trim() });
    };

    const handleJoinClick = () => {
        if (!name.trim()) {
            setNameError("Name required to join a room.");
            return;
        }
        setNameError("");
        setRoomError("");
        setShowModal(true);
    };

    const handleConfirmJoin = () => {
        if (!roomCode.trim()) {
            setRoomError("Room code is required.");
            return;
        }
        setPlayerName(name.trim());
        socket.emit('joinRoom', { name: name.trim(), roomCode: roomCode.trim() });
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setRoomCode("");
        setRoomError("");
    };

    // animation variants
    const titleVariants = {
        hidden: { y: -80, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { duration: 0.5, ease: "easeOut" } },
        exit: { y: -80, opacity: 0, transition: { duration: 0.35, ease: "easeIn" } }
    };

    const inputVariants = {
        hidden: { x: -80, opacity: 0 },
        visible: { x: 0, opacity: 1, transition: { duration: 0.45, ease: "easeOut", delay: 0.15 } },
        exit: { x: -80, opacity: 0, transition: { duration: 0.3, ease: "easeIn" } }
    };

    const btnVariants = {
        hidden: { y: 60, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { duration: 0.45, ease: "easeOut", delay: 0.28 } },
        exit: { y: 60, opacity: 0, transition: { duration: 0.3, ease: "easeIn" } }
    };

    const modalVariants = {
        hidden: { scale: 0.8, opacity: 0 },
        visible: { scale: 1, opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
        exit: { scale: 0.8, opacity: 0, transition: { duration: 0.15, ease: "easeIn" } }
    };

    return (
        <div className="lobby-page">
            <div className="scanlines" />

            <div className="lobby-container">
                {/* Title */}
                <motion.div
                    className="title-wrap"
                    variants={titleVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                >
                    <span className="title-tag">▶ MULTIPLAYER ◀</span>
                    <h1 className="title-main">
                        SKETCH<span className="title-accent">&</span><br />GUESS
                        <span className="cursor-blink" />
                    </h1>
                    <div className="pixel-divider" />
                    <span className="title-sub">DRAW · GUESS · WIN</span>
                </motion.div>

                {/* Input */}
                <motion.div
                    className="input-group"
                    variants={inputVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                >
                    <span className="input-label">▸ YOUR NAME</span>
                    <input
                        className={`pixel-input ${nameError ? "input-error" : ""}`}
                        type="text"
                        placeholder="enter name..."
                        value={name}
                        onChange={(e) => { setName(e.target.value); setNameError(""); }}
                        onKeyDown={(e) => e.key === "Enter" && handleJoinClick()}
                    />
                    <AnimatePresence>
                        {nameError && (
                            <motion.span
                                className="error-msg"
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                            >
                                ▸ {nameError}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Buttons */}
                <motion.div
                    className="btn-row"
                    variants={btnVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                >
                    <button className="pixel-btn btn-join" onClick={handleJoinClick}>▶ JOIN</button>
                    <button className="pixel-btn btn-create" onClick={handleCreateRoom}>✦ CREATE</button>
                </motion.div>

                <motion.div
                    className="deco-row"
                    variants={btnVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                >
                    <div className="deco-line" />
                </motion.div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        className="lobby-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={(e) => e.target === e.currentTarget && handleCloseModal()}
                    >
                        <motion.div
                            className="lobby-modal-box"
                            variants={modalVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                        >
                            <div className="modal-title">▸ ENTER ROOM CODE</div>

                            <div className="input-group">
                                <span className="input-label">▸ ROOM CODE</span>
                                <input
                                    className={`pixel-input ${roomError ? "input-error" : ""}`}
                                    type="text"
                                    placeholder="e.g. ABC123"
                                    value={roomCode}
                                    onChange={(e) => { setRoomCode(e.target.value); setRoomError(""); }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleConfirmJoin();
                                        if (e.key === "Escape") handleCloseModal();
                                    }}
                                    autoFocus
                                />
                                <AnimatePresence>
                                    {roomError && (
                                        <motion.span
                                            className="error-msg"
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                        >
                                            ▸ {roomError}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="modal-btns">
                                <button className="btn-cancel" onClick={handleCloseModal}>✕ CANCEL</button>
                                <button className="btn-confirm" onClick={handleConfirmJoin}>▶ JOIN</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Lobby;