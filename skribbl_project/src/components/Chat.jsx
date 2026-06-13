import { useState, useEffect, useRef } from "react";

const Chat = ({ socket, roomData, playerName, wordHint, gamePhase, hasGuessed, setHasGuessed }) => {
    const [message, setMessage] = useState("");
    const [chatMessages, setChatMessages] = useState([]);
    const chatContainerRef = useRef(null);
    const isFirstRender = useRef(true);
    const hintWordLength = wordHint ? wordHint.split(' ').length : 0;

    useEffect(() => {
        socket.on('chatMessageRecieve', (data) => {
            setChatMessages(prev => {
                const updated = [...prev, data];
                return updated.length > 50 ? updated.slice(-50) : updated;
            });
        });

        socket.on('correctGuessResult', ({ word }) => {
            setHasGuessed(true);
            setChatMessages(prev => {
                const updated = [...prev, {
                    playerName: 'Game',
                    message: `You guessed it! Word was "${word}"`,
                    type: 'guessed'
                }];
                return updated.length > 50 ? updated.slice(-50) : updated;
            });
        });

        socket.on('correctGuesser', ({ playerName: guesser }) => {
            setChatMessages(prev => {
                const updated = [...prev, { playerName: 'Game', message: `${guesser} guessed the word!`, type: 'game' }];
                return updated.length > 50 ? updated.slice(-50) : updated;
            });
        });

        socket.on('soClose', () => {
            setChatMessages(prev => {
                const updated = [...prev, { playerName: 'Game', message: "So close! Keep trying!", type: 'game' }];
                return updated.length > 50 ? updated.slice(-50) : updated;
            });
        });

        return () => {
            socket.off('chatMessageRecieve');
            socket.off('correctGuessResult');
            socket.off('correctGuesser');
            socket.off('soClose');
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
        if (!hasGuessed
            && gamePhase === 'drawing'
            && wordHint
            && message.length >= hintWordLength - 1
            && message.length <= hintWordLength + 1) {
            socket.emit('submitGuess', { guess: message, roomCode: roomData.code });
            setChatMessages(prev => {
                const updated = [...prev, { playerName, message, type: 'normal' }];
                return updated.length > 50 ? updated.slice(-50) : updated;
            });
        } else {
            if (hasGuessed) {
                socket.emit('guessedChat', { message, roomCode: roomData.code });
            } else {
                socket.emit('chatMessage', { message, roomCode: roomData.code });
            }
            setChatMessages(prev => {
                const updated = [...prev, { playerName, message, type: hasGuessed ? 'guessed' : 'normal' }];
                return updated.length > 50 ? updated.slice(-50) : updated;
            });
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
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder={hasGuessed ? "chat..." : "guess or chat..."}
                    disabled={gamePhase !== 'drawing' && gamePhase !== 'roundEnd'}
                />
                <button className="chat-send-btn" onClick={sendMessage}>▶</button>
            </div>
        </>
    );
};

export default Chat;