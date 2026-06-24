import React from "react";
import { type Socket } from "socket.io-client";

export interface Player {
    id: string;
    name: string;
    score: number;
    isHost: boolean;
}

export interface CorrectGuesser {
    id: string;
    guessedAt: number; // Date.now() returns a number
}

export interface RoomSettings {
    rounds: number;
    drawTime: number;
    maxPlayers: number;
}

export type GamePhase = "waiting" | "selecting" | "drawing" | "roundEnd" | "gameOver";
export type RoomStatus = "waiting" | "inGame";
export type Screen = "lobby" | "waiting" | "game";

export interface Room {
    code: string;
    players: Player[];
    host: string;

    currentWord: string | null;
    currentDrawer: string | null;
    wordChoices: string[];
    wordHint: string;

    round: number;
    totalRounds: number;
    totalGuessers: number;
    timeLeft: number;

    status: RoomStatus;
    gamePhase: GamePhase;

    settings: RoomSettings;
    correctGuessers: CorrectGuesser[];

    strokes: CanvasAction[];
}

export interface DrawData {
    roomCode: string;
    x: number;
    y: number;
    color: string;
    size: number;
    tool: string;
}

export interface FillData {
    roomCode: string;
    x: number;
    y: number;
    color: string;
}

export interface LeaderboardProps {
    players: Player[];
    isHost: boolean;
    correctGuessers: Set<string>;
    panelTitle?: string;
    socketId: string | null;
    currentDrawer: string | null;
    onKick: (playerId: string) => void;
}


export interface ChatProps {
    socket: Socket;
    roomData: Room;
    playerName: string;
    hasGuessed: boolean;
    setHasGuessed: React.Dispatch<React.SetStateAction<boolean>>;
    gamePhase: GamePhase;
    wordHint: string | null;
}

export interface ChatMessage {
    playerName: string;
    message: string;
    type: 'normal' | 'game' | 'guessed';
}

export interface WaitingRoomProps {
    socket: Socket;
    roomData: Room;
    setRoomData: React.Dispatch<React.SetStateAction<Room | null>>;
    setScreen: React.Dispatch<React.SetStateAction<Screen>>;
    playerName: string;
}

export interface LobbyProps {
    socket: Socket;
    setScreen: React.Dispatch<React.SetStateAction<Screen>>;
    setRoomData: React.Dispatch<React.SetStateAction<Room | null>>;
    setPlayerName: React.Dispatch<React.SetStateAction<string>>;
}

export interface DrawingBoardProps {
    socket: Socket;
    roomData: Room;
    setRoomData: React.Dispatch<React.SetStateAction<Room | null>>;
    setScreen: React.Dispatch<React.SetStateAction<Screen>>;
}

export interface Reaction {
    id: number;
    emoji: string;
    left: number;
}

export interface Points {  
    x: number;
    y: number;
}

export interface StrokeAction {
    type: "stroke";
    tool: string;
    color: string;
    size: number;
    points: Points[];
}

export interface FillAction {
    type: "fill";
    x: number;
    y: number;
    color: string;
}

export type CanvasAction = StrokeAction | FillAction;

