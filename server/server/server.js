const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// 🔥 1. IMPORT GENLAYER SDK
const { createClient } = require('genlayer-js');

// 🔥 2. SETUP THE CLIENT FOR BRADBURY TESTNET
const client = createClient({
    chain: {
        id: 4321, // Custom fallback ID
        name: 'Bradbury Testnet',
        network: 'bradbury',
        rpcUrls: {
            default: { http: ['https://rpc-bradbury.genlayer.com'] },
            public: { http: ['https://rpc-bradbury.genlayer.com'] },
        }
    }
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const rooms = {};

function generateDeck() {
    const deck = [];
    let idCounter = 0;
    const addCards = (shape, numbers) => {
        numbers.forEach(num => deck.push({ id: `card_${idCounter++}`, shape, number: num, isAction: [1, 2, 14].includes(num) }));
    };
    addCards("Circle", [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14]);
    addCards("Triangle", [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14]);
    addCards("Cross", [1, 2, 3, 5, 7, 10, 11, 13, 14]);
    addCards("Square", [1, 2, 3, 5, 7, 10, 11, 13, 14]);
    addCards("Star", [1, 2, 3, 4, 5, 7, 8]);
    return deck.sort(() => Math.random() - 0.5); 
}

function broadcastGameState(roomId) {
    const room = rooms[roomId];
    room.players.forEach(player => {
        io.to(player.id).emit('game_updated', {
            activeCard: room.activeCard,
            myHand: player.hand,
            marketCount: room.deck.length,
            currentTurnId: room.players[room.currentTurnIndex].id,
            players: room.players.map(p => ({ 
                id: p.id, 
                username: p.username, 
                cardCount: p.hand.length,
                cardSum: p.hand.reduce((sum, card) => sum + card.number, 0)
            }))
        });
    });
}

function safeDraw(room, player) {
    if (room.deck.length === 0) {
        if (room.discardPile.length > 0) {
            room.deck = room.discardPile.sort(() => Math.random() - 0.5);
            room.discardPile = [];
        } else {
            return; 
        }
    }
    player.hand.push(room.deck.pop());
}

io.on('connection', (socket) => {
    socket.on('join_room', ({ roomId, username, maxPlayers }) => {
        if (rooms[roomId] && rooms[roomId].status === 'finished') {
            delete rooms[roomId];
        }

        if (!rooms[roomId]) rooms[roomId] = { id: roomId, players: [], host: socket.id, status: 'waiting', maxPlayers: maxPlayers || 6, deck: [], discardPile: [], activeCard: null, currentTurnIndex: 0, isProcessingMove: false };
        const room = rooms[roomId];
        
        if (room.status !== 'waiting' || room.players.length >= room.maxPlayers) return;

        const existingPlayer = room.players.find(p => p.id === socket.id);
        if (!existingPlayer) {
            room.players.push({ id: socket.id, username, hand: [] });
        } else {
            existingPlayer.username = username; 
        }
        
        socket.join(roomId);
        io.to(roomId).emit('room_updated', { players: room.players.map(p => ({ id: p.id, username: p.username })), host: room.host, maxPlayers: room.maxPlayers });
    });

    socket.on('start_game', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || room.host !== socket.id || room.status !== 'waiting') return;
        
        room.status = 'playing';
        room.isProcessingMove = false; 
        room.deck = generateDeck();
        room.players.forEach(player => player.hand = room.deck.splice(0, 5));
        
        let firstIndex = room.deck.findIndex(c => !c.isAction);
        if (firstIndex === -1) firstIndex = 0; 
        room.activeCard = room.deck.splice(firstIndex, 1)[0];
        
        broadcastGameState(roomId);
    });

    socket.on('play_card', async ({ roomId, cardId }) => {
        const room = rooms[roomId];
        if (!room || room.status !== 'playing' || room.isProcessingMove) return;

        const currentPlayer = room.players[room.currentTurnIndex];
        if (socket.id !== currentPlayer.id) return;

        const cardIndex = currentPlayer.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;
        const playedCard = currentPlayer.hand[cardIndex];

        room.isProcessingMove = true;
        const matchesLocalRules = playedCard.shape === room.activeCard.shape || playedCard.number === room.activeCard.number;

        // --- DECENTRALIZED LIVE GENLAYER SDK VALIDATION ---
        let isValid = false;
        try {
            const contractAddress = "0x552D701D85bAa62F3aa8d18229d7c00AB282e373";
            
            console.log("\n=== 📡 CONTACTING GENLAYER BLOCKCHAIN ===");
            console.log(`Verifying Move: [${playedCard.shape} ${playedCard.number}] on top of [${room.activeCard.shape} ${room.activeCard.number}]`);

            // 🔥 3. THE MAGIC: The SDK handles all the complicated binary encoding!
            const result = await client.readContract({
                address: contractAddress,
                functionName: "validate_move",
                args: [
                    playedCard.shape,
                    playedCard.number,
                    room.activeCard.shape,
                    room.activeCard.number
                ]
            });

            console.log(`✅ VERDICT FROM SMART CONTRACT: ${result}`);
            console.log("=========================================\n");
            
            if (result === true || result === "true" || result === "True") {
                isValid = true;
            } else if (result === false || result === "false" || result === "False") {
                isValid = false;
            } else {
                isValid = matchesLocalRules;
            }
            
        } catch (error) {
            console.error("❌ SDK Error, evaluating locally:", error.message);
            isValid = matchesLocalRules;
        }

        if (!isValid) {
            room.isProcessingMove = false; 
            socket.emit('action_notification', { message: "❌ Invalid Move Blocked by GenLayer!" });
            return; 
        }
        // --- END OF GENLAYER VALIDATION ---

        const casterName = currentPlayer.username;
        let nextTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
        let targetPlayer = room.players[nextTurnIndex];
        let notification = "";

        if (playedCard.isAction) {
            if (playedCard.number === 1) {
                notification = `${casterName} played Hold On! ${targetPlayer.username} is skipped!`;
                nextTurnIndex = (room.currentTurnIndex + 2) % room.players.length; 
            } else if (playedCard.number === 2) {
                notification = `${casterName} played Pick 2 against ${targetPlayer.username}!`;
                safeDraw(room, targetPlayer);
                safeDraw(room, targetPlayer);
                nextTurnIndex = (room.currentTurnIndex + 2) % room.players.length;
            } else if (playedCard.number === 14) {
                notification = `${casterName} played General Market! Everyone draws!`;
                room.players.forEach(p => { if (p.id !== currentPlayer.id) safeDraw(room, p); });
                nextTurnIndex = room.currentTurnIndex; 
            }
        }

        currentPlayer.hand.splice(cardIndex, 1);
        room.discardPile.push(room.activeCard);
        room.activeCard = playedCard;

        if (currentPlayer.hand.length === 0) {
            room.status = 'finished';
            room.isProcessingMove = false; 
            broadcastGameState(roomId); 

            const leaderboard = room.players.map(p => ({
                id: p.id,
                username: p.username,
                cardCount: p.hand.length,
                cardSum: p.hand.reduce((sum, card) => sum + card.number, 0)
            })).sort((a, b) => a.cardSum - b.cardSum);

            io.to(roomId).emit('game_over', { 
                winnerId: currentPlayer.id, 
                winnerName: currentPlayer.username,
                leaderboard: leaderboard 
            });
            return; 
        } else if (currentPlayer.hand.length === 1) {
            io.to(roomId).emit('action_notification', { message: `🚨 LAST CARD: ${casterName} 🚨` });
        } else if (notification) {
            io.to(roomId).emit('action_notification', { message: notification });
        }

        room.currentTurnIndex = nextTurnIndex;
        room.isProcessingMove = false; 
        broadcastGameState(roomId);
    });

    socket.on('draw_card', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || room.status !== 'playing' || room.isProcessingMove) return;

        const currentPlayer = room.players[room.currentTurnIndex];
        if (currentPlayer.id !== socket.id) return; 

        safeDraw(room, currentPlayer);
        room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
        broadcastGameState(roomId);
    });

    socket.on('disconnect', () => {});
});

const PORT = 3001;
server.listen(PORT, () => console.log(`🔥 GenLayer Whot Server is live on port ${PORT} (Bradbury Testnet)`));