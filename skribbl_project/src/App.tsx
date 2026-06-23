import { useState } from 'react';
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