import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pen, Eraser, PaintBucket, Undo2, Redo2, Trash2 } from "lucide-react";
import "./drawingBoard.css";
import Chat from "./Chat";
import Leaderboard from "./Leaderboard";

const DrawingBoard = ({ socket, roomData, setRoomData, setScreen }) => {
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const isDrawingRef = useRef(false);
    const strokesRef = useRef([]);
    const redoRef = useRef([]);
    const currentStrokeRef = useRef(null);
    const incomingStrokeRef = useRef(null);
    const roomDataRef = useRef(roomData);

    const [tool, setTool] = useState("pen");
    const [color, setColor] = useState("black");
    const [brushSize, setBrushSize] = useState(7);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [showPalette, setShowPalette] = useState(false);
    const colorPickerRef = useRef(null);

    const colorRef = useRef(color);
    const brushSizeRef = useRef(brushSize);
    const toolRef = useRef(tool);

    const presetColors = ["#000000","#ffffff","#ff0000","#ffa500","#ffff00","#00ff00","#0000ff","#800080","#8b4513","#ff69b4"];

    const [hasGuessed, setHasGuessed] = useState(false);
    const [correctGuessers, setCorrectGuessers] = useState(new Set());
    const isHost = roomData.players.find(p => p.id === socket.id)?.isHost || false;

    const [gamePhase, setGamePhase] = useState(roomData.gamePhase);
    const [currentDrawer, setCurrentDrawer] = useState(roomData.currentDrawer);
    const [wordChoices, setWordChoices] = useState([]);
    const [currentWord, setCurrentWord] = useState(null);
    const [wordHint, setWordHint] = useState(roomData.wordHint || '');
    const [correctWord, setCorrectWord] = useState(null);
    const [round, setRound] = useState(roomData.round);
    const [pointsGained, setPointsGained] = useState(new Map());
    const [timeLeft, setTimeLeft] = useState(roomData.settings.drawTime);
    const [reactions, setReactions] = useState([]);

    // responsive offcanvas state
    const [showLbOffcanvas, setShowLbOffcanvas] = useState(false);
    const [showChatOffcanvas, setShowChatOffcanvas] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

    const emojiList = ['👍', '😂', '🔥', '😮', '❤️', '👏'];
    const isDrawer = socket.id === currentDrawer;

    // determine body class for phone layout
    const getBodyClass = () => {
        if (isDrawer) return "game-body drawer-phone";
        return "game-body non-drawer-phone";
    };

    useEffect(() => {
        socket.on('drawStart', (data) => {
            const context = contextRef.current;
            if (!context) return;
            context.strokeStyle = data.color;
            context.lineWidth = data.tool === 'eraser' ? 20 : data.size;
            context.globalCompositeOperation = data.tool === 'eraser' ? 'destination-out' : 'source-over';
            incomingStrokeRef.current = { type: "stroke", tool: data.tool, color: data.color, size: data.size, points: [{ x: data.x, y: data.y }] };
            context.beginPath();
            context.moveTo(data.x, data.y);
            incomingStrokeRef.current.points.push({ x: data.x, y: data.y });
            context.lineTo(data.x + 0.1, data.y + 0.1);
            context.stroke();
        });

        socket.on('draw', (data) => {
            const context = contextRef.current;
            if (!context) return;
            if (data.tool === 'eraser') context.lineWidth = 20;
            context.lineTo(data.x, data.y);
            context.stroke();
            incomingStrokeRef.current?.points.push({ x: data.x, y: data.y });
        });

        socket.on('drawEnd', () => {
            const context = contextRef.current;
            if (!context) return;
            context.closePath();
            if (incomingStrokeRef.current) {
                strokesRef.current.push(incomingStrokeRef.current);
                incomingStrokeRef.current = null;
            }
            updateHistoryState();
        });

        socket.on('fill', (data) => {
            floodFill(data.x, data.y, data.color);
            strokesRef.current.push({ type: "fill", x: data.x, y: data.y, color: data.color });
        });

        socket.on('clear', () => {
            const canvas = canvasRef.current;
            const context = contextRef.current;
            if (!canvas || !context) return;
            context.clearRect(0, 0, canvas.width, canvas.height);
            strokesRef.current = [];
            redoRef.current = [];
            currentStrokeRef.current = null;
            isDrawingRef.current = false;
            updateHistoryState();
        });

        socket.on('undo', () => {
            if (strokesRef.current.length === 0) return;
            redoRef.current.push(strokesRef.current.pop());
            redraw();
            updateHistoryState();
        });

        socket.on('redo', () => {
            if (redoRef.current.length === 0) return;
            strokesRef.current.push(redoRef.current.pop());
            redraw();
            updateHistoryState();
        });

        socket.on('nextTurn', ({ currentDrawer }) => {
            resetCanvas();
            setCurrentDrawer(currentDrawer);
            setGamePhase('selecting');
            setHasGuessed(false);
            setRoomData(prev => ({ ...prev, currentDrawer, wordChoices: [] }));
            setCorrectGuessers(new Set());
        });

        socket.on('roundEnded', ({ currentWord, players }) => {
            const gained = new Map(
                players.map(p => {
                    const old = roomDataRef.current.players.find(op => op.id === p.id);
                    return [p.name, p.score - (old?.score || 0)];
                })
            );
            setPointsGained(gained);
            setWordHint('');
            setRoomData(prev => ({ ...prev, players }));
            setCorrectWord(currentWord);
            setGamePhase('roundEnd');
        });

        socket.on('nextRoundStarted', ({ currentDrawer, round }) => {
            resetCanvas();
            setCurrentDrawer(currentDrawer);
            setGamePhase('selecting');
            setRound(round);
            setHasGuessed(false);
            setRoomData(prev => ({ ...prev, currentDrawer, round, wordChoices: [] }));
            setCorrectGuessers(new Set());
        });

        socket.on('gameOver', ({ players }) => {
            setRoomData(prev => ({ ...prev, players }));
            setGamePhase('gameOver');
        });

        socket.on('chooseWord', ({ wordChoices }) => {
            setWordChoices(wordChoices);
        });

        socket.on('correctGuesser', ({ playerName }) => {
            setCorrectGuessers(prev => new Set([...prev, playerName]));
        });

        socket.on('drawingPhaseStarted', ({ wordHint, currentDrawer }) => {
            setWordHint(wordHint);
            setCurrentDrawer(currentDrawer);
            setGamePhase('drawing');
        });

        socket.on('yourWord', ({ word }) => {
            setCurrentWord(word);
            setHasGuessed(true);
        });

        socket.on('timerTick', ({ timeLeft }) => {
            setTimeLeft(timeLeft);
        });

        socket.on('playersUpdated', (players) => {
            setRoomData(prev => ({ ...prev, players }));
        });

        socket.on('reaction', ({ emoji }) => {
            const id = Date.now();
            const left = Math.random() * 60 + 20;
            setReactions(prev => [...prev, { id, emoji, left }]);
            setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2000);
        });

        socket.on('kicked', () => {
            setScreen('lobby');
        });

        return () => {
            ['drawStart','draw','drawEnd','fill','clear','undo','redo','chooseWord','yourWord',
             'drawingPhaseStarted','timerTick','roundEnded','nextRoundStarted','nextTurn',
             'gameOver','correctGuesser','playersUpdated','reaction','kicked'].forEach(e => socket.off(e));
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = 800;
        canvas.height = 500;
        const context = canvas.getContext("2d");
        contextRef.current = context;
        context.lineWidth = brushSize;
        context.lineCap = "round";
        context.strokeStyle = color;

        const getTouchPos = (touch) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return {
                x: Math.floor((touch.clientX - rect.left) * scaleX),
                y: Math.floor((touch.clientY - rect.top) * scaleY)
            };
        };

        const handleTouchStart = (e) => {
            e.preventDefault();
            if (socket.id !== roomDataRef.current?.currentDrawer) return;
            const { x, y } = getTouchPos(e.touches[0]);
            const ctx = contextRef.current;
            currentStrokeRef.current = { type: "stroke", tool: toolRef.current, color: colorRef.current, size: brushSizeRef.current, points: [] };
            ctx.beginPath();
            ctx.moveTo(x, y);
            currentStrokeRef.current.points.push({ x, y });
            ctx.lineTo(x + 0.1, y + 0.1);
            ctx.stroke();
            socket.emit('drawStart', { x, y, color: colorRef.current, size: toolRef.current === 'eraser' ? 20 : brushSizeRef.current, tool: toolRef.current, roomCode: roomDataRef.current.code });
            isDrawingRef.current = true;
        };

        const handleTouchMove = (e) => {
            e.preventDefault();
            if (!isDrawingRef.current) return;
            const { x, y } = getTouchPos(e.touches[0]);
            const ctx = contextRef.current;
            ctx.lineTo(x, y);
            ctx.stroke();
            socket.emit('draw', { x, y, color: colorRef.current, size: brushSizeRef.current, tool: toolRef.current, roomCode: roomDataRef.current.code });
            currentStrokeRef.current?.points.push({ x, y });
        };

        const handleTouchEnd = (e) => {
            e.preventDefault();
            if (!isDrawingRef.current) return;
            contextRef.current.closePath();
            socket.emit('drawEnd', { roomCode: roomDataRef.current.code });
            strokesRef.current.push(currentStrokeRef.current);
            redoRef.current = [];
            currentStrokeRef.current = null;
            isDrawingRef.current = false;
            updateHistoryState();
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        canvas.addEventListener("mouseleave", handleMouseUp);
        canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
        canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
        canvas.addEventListener("touchend", handleTouchEnd, { passive: false });

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            canvas.removeEventListener("mouseleave", handleMouseUp);
            canvas.removeEventListener("touchstart", handleTouchStart);
            canvas.removeEventListener("touchmove", handleTouchMove);
            canvas.removeEventListener("touchend", handleTouchEnd);
        };
    }, []);

    useEffect(() => {
        if (roomData.gamePhase === 'selecting' && roomData.wordChoices?.length > 0 && socket.id === roomData.currentDrawer) {
            setWordChoices(roomData.wordChoices);
        }
    }, []);

    useEffect(() => { roomDataRef.current = roomData; }, [roomData]);
    useEffect(() => { setCanUndo(strokesRef.current.length > 0); setCanRedo(redoRef.current.length > 0); }, []);

    useEffect(() => {
        const handleOutside = (e) => {
            if (!showPalette) return;
            if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) setShowPalette(false);
        };
        window.addEventListener("mousedown", handleOutside);
        return () => window.removeEventListener("mousedown", handleOutside);
    }, [showPalette]);

    useEffect(() => {
        if (!contextRef.current) return;
        contextRef.current.strokeStyle = color;
        colorRef.current = color;
    }, [color]);

    useEffect(() => {
        if (!contextRef.current) return;
        contextRef.current.lineWidth = brushSize;
        brushSizeRef.current = brushSize;
    }, [brushSize]);

    useEffect(() => {
        if (!contextRef.current) return;
        if (tool === "pen") {
            contextRef.current.globalCompositeOperation = "source-over";
            contextRef.current.lineWidth = brushSize;
        } else if (tool === "eraser") {
            contextRef.current.globalCompositeOperation = "destination-out";
            contextRef.current.lineWidth = 20;
        }
        toolRef.current = tool;
    }, [tool]);

    const updateHistoryState = () => {
        setCanUndo(strokesRef.current.length > 0);
        setCanRedo(redoRef.current.length > 0);
    };

    const handleMouseDown = (e) => {
        if (socket.id !== currentDrawer) return;
        const canvas = canvasRef.current;
        const context = contextRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        if (tool === "fill") {
            floodFill(x, y);
            strokesRef.current.push({ type: "fill", x, y, color });
            socket.emit('fill', { x, y, color: colorRef.current, roomCode: roomData.code });
            redoRef.current = [];
            updateHistoryState();
            return;
        }

        currentStrokeRef.current = { type: "stroke", tool, color, size: brushSize, points: [] };
        context.beginPath();
        context.moveTo(x, y);
        currentStrokeRef.current.points.push({ x, y });
        context.lineTo(x + 0.1, y + 0.1);
        context.stroke();

        socket.emit('drawStart', { x, y, color: colorRef.current, size: toolRef.current === 'eraser' ? 20 : brushSizeRef.current, tool: toolRef.current, roomCode: roomData.code });
        currentStrokeRef.current.points.push({ x, y });
        isDrawingRef.current = true;
    };

    const handleMouseUp = () => {
        if (!isDrawingRef.current) return;
        contextRef.current.closePath();
        socket.emit('drawEnd', { roomCode: roomData.code });
        strokesRef.current.push(currentStrokeRef.current);
        redoRef.current = [];
        currentStrokeRef.current = null;
        isDrawingRef.current = false;
        updateHistoryState();
    };

    const handleMouseMove = (e) => {
        if (!isDrawingRef.current) return;
        const canvas = canvasRef.current;
        const context = contextRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) { handleMouseUp(); return; }

        context.lineTo(x, y);
        context.stroke();
        socket.emit('draw', { x, y, color: colorRef.current, size: brushSizeRef.current, tool: toolRef.current, roomCode: roomData.code });
        currentStrokeRef.current.points.push({ x, y });
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const context = contextRef.current;
        context.clearRect(0, 0, canvas.width, canvas.height);
        strokesRef.current = []; redoRef.current = [];
        currentStrokeRef.current = null; isDrawingRef.current = false;
        updateHistoryState();
        socket.emit('clear', { roomCode: roomData.code });
    };

    const resetCanvas = () => {
        const canvas = canvasRef.current;
        const context = contextRef.current;
        if (!canvas || !context) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        strokesRef.current = []; redoRef.current = [];
        currentStrokeRef.current = null; isDrawingRef.current = false;
        updateHistoryState();
    };

    const floodFill = (startX, startY, fillCol = color) => {
        const canvas = canvasRef.current;
        const ctx = contextRef.current;
        const width = canvas.width, height = canvas.height;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const stack = [[startX, startY]];
        const getIndex = (x, y) => (y * width + x) * 4;
        const startIndex = getIndex(startX, startY);
        const targetColor = [data[startIndex], data[startIndex+1], data[startIndex+2], data[startIndex+3]];
        const fillColor = hexToRgba(fillCol);
        const tolerance = 45;
        const colorsMatch = (i) =>
            Math.abs(data[i]-targetColor[0]) <= tolerance &&
            Math.abs(data[i+1]-targetColor[1]) <= tolerance &&
            Math.abs(data[i+2]-targetColor[2]) <= tolerance &&
            Math.abs(data[i+3]-targetColor[3]) <= tolerance;
        if (targetColor[0]===fillColor[0] && targetColor[1]===fillColor[1] && targetColor[2]===fillColor[2]) return;
        while (stack.length) {
            const [x, y] = stack.pop();
            let left = x, right = x;
            while (left >= 0 && colorsMatch(getIndex(left, y))) left--;
            left++;
            while (right < width && colorsMatch(getIndex(right, y))) right++;
            right--;
            for (let i = left; i <= right; i++) {
                const idx = getIndex(i, y);
                data[idx]=fillColor[0]; data[idx+1]=fillColor[1]; data[idx+2]=fillColor[2]; data[idx+3]=254;
                if (y > 0 && colorsMatch(getIndex(i, y-1))) stack.push([i, y-1]);
                if (y < height-1 && colorsMatch(getIndex(i, y+1))) stack.push([i, y+1]);
            }
        }
        ctx.putImageData(imageData, 0, 0);
    };

    const hexToRgba = (hex) => {
        const bigint = parseInt(hex.slice(1), 16);
        return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255, 255];
    };

    const undo = () => {
        if (strokesRef.current.length === 0) return;
        redoRef.current.push(strokesRef.current.pop());
        redraw(); updateHistoryState();
        socket.emit('undo', { roomCode: roomData.code });
    };

    const redo = () => {
        if (redoRef.current.length === 0) return;
        strokesRef.current.push(redoRef.current.pop());
        redraw(); updateHistoryState();
        socket.emit('redo', { roomCode: roomData.code });
    };

    const redraw = () => {
        const canvas = canvasRef.current;
        const context = contextRef.current;
        context.clearRect(0, 0, canvas.width, canvas.height);
        for (const action of strokesRef.current) {
            if (action.type === "fill") floodFill(action.x, action.y, action.color);
            else drawStroke(action);
        }
    };

    const drawStroke = (stroke) => {
        const context = contextRef.current;
        context.lineWidth = stroke.size;
        context.strokeStyle = stroke.color;
        context.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
        context.beginPath();
        context.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) context.lineTo(stroke.points[i].x, stroke.points[i].y);
        context.stroke();
    };

    const sendReaction = (emoji) => socket.emit('reaction', { roomCode: roomData.code, emoji });

    const handleKick = (playerId) => socket.emit('kickPlayer', { roomCode: roomData.code, playerId });

    // overlay animation variants — slide up from bottom
    const overlayVariants = {
        hidden:  { y: "100%", opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { duration: 0.35, ease: "easeOut" } },
        exit:    { y: "100%", opacity: 0, transition: { duration: 0.25, ease: "easeIn" } }
    };

    const backdropVariants = {
        hidden:  { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.2 } },
        exit:    { opacity: 0, transition: { duration: 0.2 } }
    };

    const offcanvasLbVariants = {
        hidden:  { x: "-100%", opacity: 0 },
        visible: { x: 0, opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
        exit:    { x: "-100%", opacity: 0, transition: { duration: 0.22, ease: "easeIn" } }
    };

    const offcanvasChatVariants = {
        hidden:  { x: "100%", opacity: 0 },
        visible: { x: 0, opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
        exit:    { x: "100%", opacity: 0, transition: { duration: 0.22, ease: "easeIn" } }
    };

    const sorted = [...roomData.players].sort((a, b) => b.score - a.score);
    const medals = ['🥇','🥈','🥉'];

    return (
        <div className="game-page">
            <div className="scanlines" />

            {/* TOP BAR */}
            <div className="game-topbar">
                <div className="topbar-left">
                    <button className="overlay-toggle-btn lb-btn" onClick={() => setShowLbOffcanvas(true)}>☰ LB</button>
                    <button className="overlay-toggle-btn chat-btn" onClick={() => setShowChatOffcanvas(true)}>☰ CHAT</button>
                    <div className={`timer-box ${timeLeft <= 10 ? 'timer-low' : ''}`}>{timeLeft}s</div>
                </div>

                <div className="hint-bar">
                    {gamePhase === 'drawing'
                        ? (isDrawer ? currentWord : wordHint)
                        : gamePhase === 'selecting'
                        ? '? ? ?'
                        : '— — —'}
                </div>

                <div className="round-tag">
                    RND {round}/{roomData.settings.rounds}
                    <button className="leave-btn" onClick={() => setShowLeaveConfirm(true)}>✕ LEAVE</button>
                </div>
            </div>

            {/* MAIN BODY */}
            <div className={getBodyClass()}>

                {/* LEADERBOARD SIDEBAR */}
                <div className="leaderboard-panel">
                    <Leaderboard
                        players={roomData.players}
                        correctGuessers={correctGuessers}
                        isHost={isHost}
                        onKick={handleKick}
                        socketId={socket.id}
                        currentDrawer={currentDrawer}
                    />
                </div>

                {/* CANVAS AREA */}
                <div className="canvas-area">
                    <canvas
                        ref={canvasRef}
                        className="game-canvas"
                        onMouseDown={handleMouseDown}
                    />

                    {isDrawer && (
                        <div className="db-controls">
                            <div className="db-tool-group">
                                <button className={`db-tool-btn ${tool === "pen" ? "active" : ""}`} onClick={() => setTool("pen")} title="Pen"><Pen size={16} /></button>
                                <button className={`db-tool-btn ${tool === "eraser" ? "active" : ""}`} onClick={() => setTool("eraser")} title="Eraser"><Eraser size={16} /></button>
                                <button className={`db-tool-btn ${tool === "fill" ? "active" : ""}`} onClick={() => setTool("fill")} title="Fill"><PaintBucket size={16} /></button>
                            </div>
                            <div className="db-tool-group">
                                <button className="db-tool-btn" onClick={undo} disabled={!canUndo} title="Undo"><Undo2 size={16} /></button>
                                <button className="db-tool-btn" onClick={redo} disabled={!canRedo} title="Redo"><Redo2 size={16} /></button>
                                <button className="db-tool-btn" onClick={clearCanvas} title="Clear"><Trash2 size={16} /></button>
                            </div>
                            <div className="db-tool-group">
                                <div className="db-color-picker-wrap" ref={colorPickerRef}>
                                    <button
                                        className="db-color-swatch"
                                        style={{ backgroundColor: color }}
                                        onClick={() => setShowPalette(s => !s)}
                                        title="Color"
                                    />
                                    <AnimatePresence>
                                        {showPalette && (
                                            <motion.div
                                                className="db-palette-popup"
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                transition={{ duration: 0.15 }}
                                            >
                                                {presetColors.map(c => (
                                                    <button
                                                        key={c}
                                                        className={`db-color-option ${color === c ? "selected" : ""}`}
                                                        style={{ backgroundColor: c }}
                                                        onClick={() => { setColor(c); setShowPalette(false); }}
                                                    />
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <input
                                        className="db-brush-slider"
                                        type="range" min="1" max="30"
                                        value={brushSize}
                                        onChange={e => setBrushSize(Number(e.target.value))}
                                        title={`Brush size ${brushSize}`}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="reactions-container">
                        {reactions.map(r => (
                            <span key={r.id} className="floating-reaction" style={{ left: `${r.left}%` }}>{r.emoji}</span>
                        ))}
                    </div>

                    <div className="emoji-bar">
                        {emojiList.map(emoji => (
                            <button key={emoji} className="emoji-btn" onClick={() => sendReaction(emoji)}>{emoji}</button>
                        ))}
                    </div>
                </div>

                {/* CHAT SIDEBAR */}
                <div className="chat-panel">
                    <Chat
                        socket={socket}
                        roomData={roomData}
                        playerName={roomData?.players?.find(p => p.id === socket.id)?.name}
                        wordHint={gamePhase === 'drawing' ? wordHint : null}
                        gamePhase={gamePhase}
                        hasGuessed={hasGuessed}
                        setHasGuessed={setHasGuessed}
                    />
                </div>
            </div>

            {/* ── OFFCANVAS: LEADERBOARD ── */}
            <AnimatePresence>
                {showLbOffcanvas && (
                    <>
                        <motion.div className="offcanvas-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLbOffcanvas(false)} />
                        <motion.div className="offcanvas-lb" variants={offcanvasLbVariants} initial="hidden" animate="visible" exit="exit">
                            <Leaderboard players={roomData.players} correctGuessers={correctGuessers} isHost={isHost} onKick={(id) => { handleKick(id); setShowLbOffcanvas(false); }} panelTitle="▸ SCORES" socketId={socket.id} currentDrawer={currentDrawer} />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── OFFCANVAS: CHAT ── */}
            <AnimatePresence>
                {showChatOffcanvas && (
                    <>
                        <motion.div className="offcanvas-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowChatOffcanvas(false)} />
                        <motion.div className="offcanvas-chat" variants={offcanvasChatVariants} initial="hidden" animate="visible" exit="exit">
                            <Chat
                                socket={socket}
                                roomData={roomData}
                                playerName={roomData?.players?.find(p => p.id === socket.id)?.name}
                                wordHint={gamePhase === 'drawing' ? wordHint : null}
                                gamePhase={gamePhase}
                                hasGuessed={hasGuessed}
                                setHasGuessed={setHasGuessed}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── OVERLAY: WORD SELECTING ── */}
            <AnimatePresence>
                {gamePhase === 'selecting' && (
                    <motion.div className="game-overlay-backdrop" variants={backdropVariants} initial="hidden" animate="visible" exit="exit">
                        <motion.div className="game-overlay-box" variants={overlayVariants} initial="hidden" animate="visible" exit="exit">
                            <span className="overlay-tag">▶ ROUND {round}</span>
                            {isDrawer ? (
                                <>
                                    <div className="overlay-title">CHOOSE A WORD</div>
                                    <div className="overlay-pixel-divider" />
                                    <div className="word-choices">
                                        {wordChoices.map(word => (
                                            <button key={word} className="word-choice-btn" onClick={() => {
                                                socket.emit('wordChosen', { roomCode: roomData.code, word });
                                                setGamePhase('drawing');
                                            }}>
                                                {word}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="overlay-title">GET READY!</div>
                                    <div className="overlay-pixel-divider" />
                                    <div className="overlay-subtitle">WAITING FOR DRAWER...</div>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── OVERLAY: ROUND END ── */}
            <AnimatePresence>
                {gamePhase === 'roundEnd' && (
                    <motion.div className="game-overlay-backdrop" variants={backdropVariants} initial="hidden" animate="visible" exit="exit">
                        <motion.div className="game-overlay-box" variants={overlayVariants} initial="hidden" animate="visible" exit="exit">
                            <span className="overlay-tag">▶ TURN OVER</span>
                            <div className="overlay-title">THE WORD WAS</div>
                            <div className="overlay-pixel-divider" />
                            <div style={{ fontSize: '16px', color: '#f5c518', letterSpacing: '4px' }}>{correctWord}</div>
                            <div className="overlay-scores">
                                {[...roomData.players]
                                    .sort((a, b) => b.score - a.score)
                                    .map((p, i) => (
                                        <div key={p.id} className={`overlay-score-row ${i === 0 ? 'winner' : ''}`}>
                                            <span className="overlay-score-rank">#{i + 1}</span>
                                            <span className="overlay-score-name">{p.name}</span>
                                            <span className="overlay-score-pts">{p.score}</span>
                                            <span className="overlay-score-gained">
                                                {pointsGained.get(p.name) > 0 ? `+${pointsGained.get(p.name)}` : ''}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                            <div className="overlay-next-msg">■ NEXT ROUND STARTING...</div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── OVERLAY: GAME OVER ── */}
            <AnimatePresence>
                {gamePhase === 'gameOver' && (
                    <motion.div className="game-overlay-backdrop" variants={backdropVariants} initial="hidden" animate="visible" exit="exit">
                        <motion.div className="game-overlay-box" variants={overlayVariants} initial="hidden" animate="visible" exit="exit">
                            <span className="overlay-tag">▶ GAME OVER</span>
                            <div className="overlay-title">FINAL SCORES</div>
                            <div className="overlay-pixel-divider" />
                            <div className="gameover-podium">
                                {[...roomData.players]
                                    .sort((a, b) => b.score - a.score)
                                    .map((p, i) => (
                                        <div key={p.id} className={`podium-row ${i === 0 ? 'first' : i === 1 ? 'second' : i === 2 ? 'third' : ''}`}>
                                            <span className="podium-medal">{medals[i] || `#${i+1}`}</span>
                                            <span className="podium-name">{p.name}</span>
                                            <span className="podium-score">{p.score}</span>
                                        </div>
                                    ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── LEAVE CONFIRM MODAL ── */}
            <AnimatePresence>
                {showLeaveConfirm && (
                    <motion.div
                        className="lb-kick-modal-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={(e) => e.target === e.currentTarget && setShowLeaveConfirm(false)}
                    >
                        <motion.div
                            className="lb-kick-modal-box"
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1, transition: { duration: 0.18 } }}
                            exit={{ scale: 0.85, opacity: 0, transition: { duration: 0.14 } }}
                        >
                            <div className="modal-title">▸ LEAVE GAME?</div>
                            <div className="kick-name">You will lose your progress.</div>
                            <div className="modal-btns">
                                <button className="btn-cancel" onClick={() => setShowLeaveConfirm(false)}>✕ STAY</button>
                                <button className="btn-kick-confirm" onClick={() => { socket.disconnect(); setRoomData(null); setScreen('lobby'); socket.connect(); }}>▶ LEAVE</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DrawingBoard;