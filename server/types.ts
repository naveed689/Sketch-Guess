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
    timeLeft: number;

    status: RoomStatus;
    gamePhase: GamePhase;

    settings: RoomSettings;
    correctGuessers: CorrectGuesser[];
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