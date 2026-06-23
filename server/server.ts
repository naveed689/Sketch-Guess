import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { generateRoomCode, levenshtein } from './utils/roomUtils';
import { getRandomWords } from './utils/word';
import { Room, Player, CorrectGuesser, RoomSettings, DrawData, FillData } from './types';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || "http://localhost:5173" }
});

// In-memory storage for rooms, timers, and player-room mapping
const rooms = new Map<string, Room>();
const timers = new Map<string, ReturnType<typeof setInterval>>();
const playerRoomMap = new Map<string, string>();


function startTimer(roomCode: string): void {
    const room = rooms.get(roomCode);
    if (!room) return;
    let timeLeft: number = room.settings.drawTime;
    const interval = setInterval(() => {
        timeLeft--;
        room.timeLeft = timeLeft;
        io.to(roomCode).emit('timerTick', { timeLeft });
        if (timeLeft <= 0) {
            clearInterval(interval);
            timers.delete(roomCode);
            endRound(roomCode);
        }
    }, 1000);
    timers.set(roomCode, interval);
}


function endRound(roomCode: string): void {
    const room = rooms.get(roomCode);
    if (!room) return;

    room.gamePhase = 'roundEnd';

    // Clear the timer for this room
    clearInterval(timers.get(roomCode));
    timers.delete(roomCode);

    calculateScores(room);

    // remove all players from the guessed room
    room.correctGuessers.forEach(guesser => {
        const guesserSocket = io.sockets.sockets.get(guesser.id);
        if (guesserSocket) guesserSocket.leave(`${roomCode}-guessed`);
    });

    // remove drawer from guessed room
    if (!room.currentDrawer) return;
    const drawerSocket = io.sockets.sockets.get(room.currentDrawer); 
    if (drawerSocket) drawerSocket.leave(`${roomCode}-guessed`);

    room.correctGuessers = []; // ids of players who guessed correctly this round

    // Emit the round ended event with the correct word to everyone in the room
    io.to(roomCode).emit('roundEnded', {
        currentWord: room.currentWord,  
        players: room.players,
    });

    setTimeout(() => {
        if (!room || room.players.length === 0) return; // room empty, abort
        const drawerIndex = room.players.findIndex(p => p.id === room.currentDrawer);

        if (drawerIndex === room.players.length - 1) {
            if(room.round < room.settings.rounds) {
                room.round++;
                room.currentDrawer = room.players[0].id; // loop back to first player as drawer
                room.gamePhase = 'selecting';
                room.wordChoices = getRandomWords(3);
                io.to(roomCode).emit('nextRoundStarted', {
                    currentDrawer: room.currentDrawer,
                    round: room.round,
                });

                io.to(room.currentDrawer).emit('chooseWord', { wordChoices: room.wordChoices });
            } else {
                room.gamePhase = 'gameOver';
                io.to(roomCode).emit('gameOver', {players: room.players});
                resetRoom(roomCode);
            }
        } else {
            room.currentDrawer = room.players[drawerIndex + 1].id; // next player becomes the drawer
            room.gamePhase = 'selecting';
            room.wordChoices = getRandomWords(3);

            io.to(roomCode).emit('nextTurn', {
                currentDrawer: room.currentDrawer,
                round: room.round,
            });

            io.to(room.currentDrawer).emit('chooseWord', { wordChoices: room.wordChoices });

        }
    }, 10000); // 10 second delay
}

function calculateScores(room: Room): void {
    // base points for guessing correctly, can be adjusted or made more complex later
    const basePoints = 100;

    const totalGuessers = room.players.length - 1; // excluding the drawer
    const correctGuessers = room.correctGuessers;
    const players = room.players;

    // sort correct guessers by who guessed first
    correctGuessers.sort((a, b) => a.guessedAt - b.guessedAt);

    // award points to guessers based on how quickly they guessed
    for(let i = 0 ; i < correctGuessers.length; i++) {
        const guesser = players.find(p => p.id === correctGuessers[i].id);

        if (guesser) {
            // more points for guessing earlier, can be adjusted with a formula
            const pointsEarned = basePoints * ((correctGuessers.length - i) / correctGuessers.length);
            guesser.score += Math.round(pointsEarned);
        }
    }

    // award points to the drawer based on how many guessed correctly
    const drawer = players.find(p => p.id === room.currentDrawer);
    if (drawer) {
        const drawerPoints = basePoints * (correctGuessers.length / totalGuessers);
        drawer.score += Math.round(drawerPoints);
    }
}

function resetRoom(roomCode: string): void {
    setTimeout(() => {
        const room = rooms.get(roomCode);
        if (!room || room.players.length === 0) return;

        // reset all scores
        room.players.forEach(p => p.score = 0);

        // reset game state
        room.status = 'waiting';
        room.gamePhase = 'waiting';
        room.currentDrawer = null;
        room.currentWord = null;
        room.wordHint = '';
        room.wordChoices = [];
        room.round = 1;
        room.correctGuessers = [];

        io.to(roomCode).emit('backToLobby', { players: room.players });
    }, 5000); // 5 second delay so players can see final scores
}


io.on('connection', (socket: Socket) => {
    // Connection established
    console.log('player connected:', socket.id);

    // Canvas events
    socket.on('draw', (data: DrawData) => {

        const {roomCode} = data;
        if (!roomCode) return; // no room code, ignore

        // forward to everyone except the sender
        socket.to(roomCode).emit('draw', data);
    });

    socket.on('drawStart', (data: DrawData) => {
        const {roomCode} = data;
        if (!roomCode) return; // no room code, ignore
        socket.to(roomCode).emit('drawStart', data);
    });

    socket.on('drawEnd', (data: { roomCode: string }) => {
        const {roomCode} = data;
        if (!roomCode) return; // no room code, ignore
        socket.to(roomCode).emit('drawEnd', data);
    });

    socket.on('fill', (data: FillData) => {
        const {roomCode} = data;
        if (!roomCode) return; // no room code, ignore
        socket.to(roomCode).emit('fill', data);
    });

    socket.on('clear', (data: { roomCode: string }) => {
        const {roomCode} = data;
        if (!roomCode) return; // no room code, ignore
        socket.to(roomCode).emit('clear', data);
    });

    socket.on('undo', (data: { roomCode: string }) => {
        const {roomCode} = data;
        if (!roomCode) return; // no room code, ignore
        socket.to(roomCode).emit('undo', data);
    });

    socket.on('redo', (data: { roomCode: string }) => {
        const {roomCode} = data;
        if (!roomCode) return; // no room code, ignore
        socket.to(roomCode).emit('redo', data);
    });
    //End of canvas events

    // ROOM events
    // create room event
    socket.on('createRoom', (data: { name: string }) => {
        // data is the player's data sent from React

        // 1. generate a room code
        const roomCode = generateRoomCode();

        // 2. create the player object for the host
        const player: Player = {
            id: socket.id,
            name: data.name,
            score: 0,
            isHost: true
        };

        // 3. create the room and store it in our Map
        const room: Room = {
            code: roomCode,
            players: [player],
            host: socket.id,
            currentWord: null,
            currentDrawer: null,
            round: 0,
            totalRounds: 3,        
            status: "waiting",     // waiting | inGame | 
            wordChoices: [],       // words to choose from when the drawer is selecting a word
            gamePhase: "waiting",     // waiting | selecting | drawing | roundEnd | gameOver
            timeLeft: 0,
            wordHint: '',          
            settings: {            // default room settings, can be made customizable later
                rounds: 3,
                drawTime: 30,
                maxPlayers: 8
            },
            correctGuessers: [],   // ids of players who guessed correctly this round
        };

        // 4. make this socket officially join the Socket.io room
        // add the host player in the room they just created
        rooms.set(roomCode, room);
        socket.join(roomCode);

        // store the room code for the player
        playerRoomMap.set(socket.id, roomCode);

        // 5. tell the client it worked, send back the room data
        socket.emit('roomCreated');
        io.to(roomCode).emit('roomUpdated', room);
        console.log(`${data.name} created room ${roomCode}`);
    });

    // join room event
    socket.on('joinRoom', (data: { name: string; roomCode: string }) => {
        const { roomCode } = data;
        // 1. check if the room exists
        if (!rooms.has(roomCode)) {
            socket.emit('roomNotFound');
            return;
        }
        // check if the room is full
        const room = rooms.get(roomCode)!;
        if (room.players.length >= room.settings.maxPlayers) {
            socket.emit('roomFull');
            return;
        }
        // check if the name is already taken in the room
        const nameExists = room.players.some(p => p.name === data.name);
        if (nameExists) {
            socket.emit('nameTaken');
            return;
        }
        // create the player object
        const player: Player = {
            id: socket.id,
            name: data.name,
            score: 0,
            isHost: false
        };
        // add the player to the room
        room.players.push(player);
        // make this socket officially join the Socket.io room
        socket.join(roomCode);
        // store the room code for the player
        playerRoomMap.set(socket.id, roomCode);
        socket.emit('roomJoined');
        // send the updated room data to everyone in the room (including the new player)
        // so everyone has the latest room info (like the new player added to the list)
        if (room.status === 'inGame') {
            if (room.currentWord) {
                room.wordHint = '_ '.repeat(room.currentWord.length).trim();
            }
            // if joining during roundEnd, send them selecting/drawing state instead
            // so they don't get stuck waiting for a transition that may have already queued
            const safeRoom = { ...room };
            if (room.gamePhase === 'roundEnd') {
                // They'll receive nextTurn/nextRoundStarted when the timeout fires
                // Just show them a waiting state — send gamePhase as 'selecting' with no wordChoices
                safeRoom.gamePhase = 'selecting';
                safeRoom.wordChoices = [];
                safeRoom.currentWord = null;
                safeRoom.wordHint = '';
            }
            socket.emit('roomUpdated', safeRoom);
            socket.to(roomCode).emit('playersUpdated', room.players);
        } else {
            io.to(roomCode).emit('roomUpdated', room);
        }
        console.log(`${data.name} joined room ${roomCode}`);
    });

    // update settings event
    socket.on('updateSettings', (data: { roomCode: string; settings: Partial<RoomSettings> }) => {
        const room = rooms.get(data.roomCode);
        if (!room) return;
        if (room.host !== socket.id) return; // only host can change settings
        
        room.settings = { ...room.settings, ...data.settings };
        io.to(data.roomCode).emit('roomUpdated', room);
    });

    // start game event
    socket.on('startGame', (data: { roomCode: string }) => {
        console.log('startGame event received with data:', data);
        const { roomCode } = data;
        const room = rooms.get(roomCode);   
        
        if (!room) return; // room not found

        if(room.players.length < 2) {
            socket.emit('notEnoughPlayers');
            return;
        }

        if (room.host !== socket.id) return; // only host can start the game

        room.round = 1;
        room.gamePhase = "selecting"; // drawer is selecting a word

        room.currentDrawer = room.players[0].id; // first player is the drawer in round 1 
        room.wordChoices = getRandomWords(3);

        room.status = "inGame"; // game is now in progress

        // Tell everyone the game is starting and who the drawer is
        console.log('emitting gameStarted with:', {
            currentDrawer: room.currentDrawer,
            round: room.round,
            totalRounds: room.totalRounds,
        });

        io.to(roomCode).emit('gameStarted', {
            currentDrawer: room.currentDrawer,
            round: room.round,
            totalRounds: room.totalRounds,
            wordChoices: room.wordChoices,
        });

        console.log(`Game started in room ${roomCode}`);
    });

    // word chosen event
    socket.on('wordChosen', (data: { roomCode: string; word: string }) => {
        const { roomCode, word } = data;
        const room = rooms.get(roomCode);
        if (!room) return;

        room.currentWord = word;
        room.gamePhase = 'drawing';
        room.wordChoices = [];

        // Tell everyone drawing has started
        // Drawer gets the word, others get the length as underscores
        const wordHint = '_ '.repeat(word.length).trim();

        io.to(roomCode).emit('drawingPhaseStarted', {
            wordHint,
            currentDrawer: room.currentDrawer,
        });

        // Send the actual word only to the drawer
        io.to(room.currentDrawer!).emit('yourWord', { word });
        // add drawer to guessed room so they can chat there
        const drawerSocket = io.sockets.sockets.get(room.currentDrawer!);
        if (drawerSocket) drawerSocket.join(`${roomCode}-guessed`);

        console.log(`Player ${room.currentDrawer} chose the word "${word}" in room ${roomCode}`);

        // start the round timer
        startTimer(roomCode); 
    });

    // chat message event
    socket.on('chatMessage', (data: { roomCode: string; message: string }) => {
        const { roomCode, message } = data;

        const room = rooms.get(roomCode);
        if (!room) return; // room not found, ignore

        const player = room.players.find(p => p.id === socket.id);
        if(!player) return; // player not found in room, ignore

        // broadcast the chat message to everyone in the room
        socket.to(roomCode).emit('chatMessageRecieve', { message, playerName: player.name, type: 'normal' });
    });

    socket.on('guessedChat', (data: { roomCode: string; message: string }) => {
        const { roomCode, message } = data;
        
        const room = rooms.get(roomCode);
        if (!room) return; // room not found, ignore
        const player = room.players.find(p => p.id === socket.id);

        if(!player) return; // player not found in room, ignore

        socket.to(`${roomCode}-guessed`).emit('chatMessageRecieve', {
            playerName: player.name,
            message,
            type: 'guessed'
        });
    });

    socket.on('submitGuess', (data: { roomCode: string; guess: string }) => {
        const { roomCode, guess } = data;
        
        const room = rooms.get(roomCode);
        if(!room) return; // room not found, ignore
        if (room.correctGuessers.find(g => g.id === socket.id)) return; // player already guessed correctly this round

        const correctWord = room.currentWord!.toLowerCase().trim();
        const normalizedGuess = guess.toLowerCase().trim();
        const player = room.players.find(p => p.id === socket.id);

        if(!player) return; // player not found in room, ignore

        if(normalizedGuess === correctWord) {
            // Handle correct guess
            room.correctGuessers.push({ id: socket.id, guessedAt: Date.now() });

            io.to(roomCode).emit('correctGuesser', {
                playerName: player.name, 
            });

            io.to(socket.id).emit('correctGuessResult', { word: correctWord });

            socket.join(`${roomCode}-guessed`); // add the player to a special Socket.io room for those who guessed correctly

            // Check if all players (except the drawer) have guessed correctly
            const nonDrawers = room.players.length - 1; // excluding the drawer
            if (room.correctGuessers.length === nonDrawers) {
                endRound(roomCode);
            }
        } else {
            const distance = levenshtein(normalizedGuess, correctWord);
            if (distance <= 2) {
                socket.emit('soClose');  // only to the guesser
            }
        }
    });

    // reaction event
    socket.on('reaction', (data: { roomCode: string; emoji: string }) => {
        const { roomCode, emoji } = data;
        io.to(roomCode).emit('reaction', { emoji });
    });

    socket.on('kickPlayer', (data: { roomCode: string; playerId: string }) => {
        const { roomCode, playerId } = data;
        const room = rooms.get(roomCode);
        if (!room) return;
        if (room.host !== socket.id) return; // only host can kick

        // remove the player from the room's player list
        const player = room.players.find(p => p.id === playerId);
        if (!player) return; // player not found

        room.players = room.players.filter(p => p.id !== playerId);
        playerRoomMap.delete(playerId);
        socket.to(roomCode).emit('playerKicked', { playerName: player.name });

        // if the kicked player is currently in the guessed room, remove them from there too
        const kickedSocket = io.sockets.sockets.get(playerId);
        if (kickedSocket) {
            kickedSocket.emit('kicked');
            kickedSocket.leave(roomCode);
            kickedSocket.leave(`${roomCode}-guessed`);
        }
        
        // if only one player left, end the game
        if (room.status === 'inGame' && room.players.length === 1) {
            clearInterval(timers.get(roomCode));
            timers.delete(roomCode);
            room.gamePhase = 'gameOver';
            io.to(roomCode).emit('gameOver', { players: room.players });
            resetRoom(roomCode);
            return;
        }
        
        io.to(roomCode).emit('playersUpdated', room.players); // update player list for everyone in the room

        // if the kicked player was the drawer, end the round
        if (room.status === 'inGame' && room.currentDrawer === playerId) {
            endRound(roomCode);
        }
    });

    // handle player disconnect
    socket.on('disconnect', () => {
        console.log('player left:', socket.id);
        
        const roomCode = playerRoomMap.get(socket.id);
        if (!roomCode) return; // player was not in a room

        const room = rooms.get(roomCode);
        if (!room) return; // room not found (shouldn't happen)

        // Remove the player from the room's player list
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return; // player not found in room, ignore    
        
        room.players = room.players.filter(p => p.id !== socket.id);
        playerRoomMap.delete(socket.id);
        socket.to(roomCode).emit('playerLeft', { playerId: socket.id });

        if (room.players.length === 0) {    
            rooms.delete(roomCode);
            return; // stop here, nothing else to do
        }

        if (player.isHost) {
            room.host = room.players[0].id;
            room.players[0].isHost = true;
            socket.to(roomCode).emit('newHost', { playerId: room.host });
        }

        if (room.status === 'inGame' && room.players.length === 1) {
            clearInterval(timers.get(roomCode));
            timers.delete(roomCode);
            room.gamePhase = 'gameOver';
            io.to(roomCode).emit('gameOver', { players: room.players });
            resetRoom(roomCode);
            return;
        }

        io.to(roomCode).emit('playersUpdated', room.players);

        if (room.status === 'inGame' && room.currentDrawer === socket.id) {
            endRound(roomCode);
        }
    });
});

httpServer.listen(process.env.PORT || 3001, () => {
    console.log('Server running', process.env.PORT || 3001);
});