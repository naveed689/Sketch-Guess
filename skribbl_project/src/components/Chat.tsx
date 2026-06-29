import { useState, useEffect, useRef } from "react";
import { type ChatMessage, type ChatProps } from "../types";

const Chat = ({ socket, roomData, playerName, wordHint, gamePhase, hasGuessed, setHasGuessed, chatMessages, setChatMessages }: ChatProps) => {
    const [message, setMessage] = useState("");
    const chatContainerRef = useRef<HTMLDivElement | null>(null);
    const isFirstRender = useRef(true);
    const MAX_LENGTH = 100;

    useEffect(() => {
        // Named handlers defined inside useEffect so the same reference
        // is used for both socket.on and socket.off
        const onChatMessageRecieve = (data: ChatMessage) => {
            setChatMessages(prev => {
                const updated = [...prev, data];
                return updated.length > 50 ? updated.slice(-50) : updated;
            });
        };

        const onCorrectGuessResult = ({ word }: { word: string }) => {
            setHasGuessed(true);
            setChatMessages(prev => {
                const updated = [...prev, {
                    playerName: 'Game',
                    message: `You guessed it! Word was "${word}"`,
                    type: 'guessed' as const
                }];
                return updated.length > 50 ? updated.slice(-50) : updated;
            });
        };

        const onCorrectGuesser = ({ playerName: guesser }: { playerName: string }) => {
            setChatMessages(prev => {
                const updated = [...prev, { playerName: 'Game', message: `${guesser} guessed the word!`, type: 'game' as const }];
                return updated.length > 50 ? updated.slice(-50) : updated;
            });
        };

        const onSoClose = () => {
            setChatMessages(prev => {
                const updated = [...prev, { playerName: 'Game', message: "So close! Keep trying!", type: 'game' as const }];
                return updated.length > 50 ? updated.slice(-50) : updated;
            });
        };

        socket.on('chatMessageRecieve', onChatMessageRecieve);
        socket.on('correctGuessResult', onCorrectGuessResult);
        socket.on('correctGuesser', onCorrectGuesser);
        socket.on('soClose', onSoClose);

        return () => {
            // Pass the exact same reference so only THIS handler is removed,
            // not all listeners for the event (which would kill sibling Chat instances)
            socket.off('chatMessageRecieve', onChatMessageRecieve);
            socket.off('correctGuessResult', onCorrectGuessResult);
            socket.off('correctGuesser', onCorrectGuesser);
            socket.off('soClose', onSoClose);
        };
    }, [socket]);

    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatMessages]);

    const sendMessage = () => {
        if (!message) return;

        if(gamePhase === 'waiting') {
            // In waiting room, all messages are normal chat
            socket.emit('chatMessage', { message, roomCode: roomData.code });
        } else if(roomData.currentDrawer === socket.id) {
            // Drawer cannot guess, only chat
            socket.emit('guessedChat', { message, roomCode: roomData.code });
        } else if (!hasGuessed) {
            // Server decide if it's a valid guess
            // Server checks room.currentWord, room.gamePhase, and correctGuessers
            socket.emit('submitGuess', { guess: message, roomCode: roomData.code });
        } else {
            // Already guessed correctly — send to guessed channel
            socket.emit('guessedChat', { message, roomCode: roomData.code });
        }

        setMessage("");
    };

    return (
        <>
            <div className="panel-title">▸ CHAT</div>
            <div className="chat-messages" ref={chatContainerRef}>
                {chatMessages.map((msg, index) => {
                    const isMe = msg.playerName === playerName;
                    const isGame = msg.type === 'game';
                    const isGuessed = msg.type === 'guessed';

                    if (isGame) {
                        return (
                            <div key={index} className="chat-msg-game">
                                <span>{msg.message}</span>
                            </div>
                        );
                    }

                    return (
                        <div key={index} className={`chat-msg-normal ${isMe ? 'me' : ''}`}>
                            <span className="chat-sender">{isMe ? 'YOU' : msg.playerName.toUpperCase()}</span>
                            <span className={`chat-bubble ${isGuessed ? 'guessed' : ''}`}>{msg.message}</span>
                        </div>
                    );
                })}
            </div>
            <div className="chat-input-row">
                <input
                    className="chat-input"
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder={hasGuessed ? "chat..." : "guess or chat..."}
                    disabled={gamePhase !== 'drawing' && gamePhase !== 'roundEnd' && gamePhase !== 'waiting'}
                    maxLength={MAX_LENGTH}
                />
                <button className="chat-send-btn" onClick={sendMessage}>▶</button>
            </div>

             {/* Character count bar */}
            <div className="chat-char-bar">
                <div
                    className="chat-char-fill"
                    style={{
                        width: `${(message.length / MAX_LENGTH) * 100}%`,
                        background: message.length > 80 ? '#ff4d4d' : '#f5c518'
                    }}
                />
            </div>
        </>
    );
};

export default Chat;