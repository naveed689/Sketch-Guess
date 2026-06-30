import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { AnimatePresence } from 'framer-motion';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import DrawingBoard from './components/DrawingBoard';
import type { Room, Screen } from './types';

const socket = io(import.meta.env.VITE_SERVER_URL);

const App = () => {
    const [screen, setScreen] = useState<Screen>("lobby");
    const [roomData, setRoomData] = useState<Room | null>(null);
    const [playerName, setPlayerName] = useState<string>("");

    // useEffect(() => {
    //     const handleConnect = () => {
    //         console.log('🟢 SOCKET CONNECTED', socket.id, new Date().toISOString());
    //     };
    //     const handleDisconnect = (reason: string) => {
    //         console.log('🔴 SOCKET DISCONNECTED', reason, new Date().toISOString());
    //     };
    //     const handleReconnectAttempt = (attempt: number) => {
    //         console.log('🟡 RECONNECT ATTEMPT', attempt, new Date().toISOString());
    //     };
    //     const handleVisibility = () => {
    //         console.log(' VISIBILITY', document.visibilityState, new Date().toISOString());
    //     };

    //     socket.on('connect', handleConnect);
    //     socket.on('disconnect', handleDisconnect);
    //     socket.io.on('reconnect_attempt', handleReconnectAttempt);
    //     document.addEventListener('visibilitychange', handleVisibility);

    //     return () => {
    //         socket.off('connect', handleConnect);
    //         socket.off('disconnect', handleDisconnect);
    //         socket.io.off('reconnect_attempt', handleReconnectAttempt);
    //         document.removeEventListener('visibilitychange', handleVisibility);
    //     };
    // }, []);

    return (
        <AnimatePresence mode="wait">
            {screen === "lobby" &&
                <Lobby
                    key="lobby"
                    socket={socket}
                    setScreen={setScreen}
                    setRoomData={setRoomData}
                    setPlayerName={setPlayerName}
                />}
            {screen === "waiting" && roomData && playerName &&
                <WaitingRoom
                    key="waiting"
                    socket={socket}
                    roomData={roomData}
                    setRoomData={setRoomData}
                    setScreen={setScreen}
                    playerName={playerName}
                />}
            {screen === "game" && roomData && playerName &&
                <DrawingBoard
                    key="game"
                    socket={socket}
                    roomData={roomData}
                    setRoomData={setRoomData}
                    setScreen={setScreen}
                />}
        </AnimatePresence>
    );
};

export default App;