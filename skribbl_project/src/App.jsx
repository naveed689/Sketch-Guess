import { useState } from 'react';
import { io } from 'socket.io-client';
import { AnimatePresence } from 'framer-motion';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import DrawingBoard from './components/DrawingBoard';

const socket = io('http://localhost:3001');

const App = () => {
    const [screen, setScreen] = useState("lobby");
    const [roomData, setRoomData] = useState(null);
    const [playerName, setPlayerName] = useState("");

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
            {screen === "waiting" &&
                <WaitingRoom
                    key="waiting"
                    socket={socket}
                    roomData={roomData}
                    setRoomData={setRoomData}
                    setScreen={setScreen}
                    playerName={playerName}
                />}
            {screen === "game" &&
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