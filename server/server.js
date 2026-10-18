// server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const ScoponeGame = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../public')));
app.use('/img', express.static(path.join(__dirname, '../img'))); // Se la cartella img è fuori da public

const game = new ScoponeGame();

io.on('connection', (socket) => {
    console.log(`Un utente si è connesso: ${socket.id}`);

    socket.on('join-game', (name) => {
        const added = game.addPlayer(socket.id, name);
        if (!added) {
            socket.emit('error-message', 'Il tavolo è già pieno (4 giocatori)!');
            return;
        }

        updateGameState();

        if (game.isReadyToStart() && !game.gameStarted) {
            game.startNewHand();
            io.emit('game-started');
            updateGameState();
        }
    });

    socket.on('play-card', ({ cardId, targetCardIds }) => {
        const result = game.playCard(socket.id, cardId, targetCardIds);
        if (!result.success) {
            socket.emit('error-message', result.message);
            return;
        }

        // Se è stata fatta una scopa, avvisa tutti i client
        if (result.isScopa) {
            io.emit('scopa-made');
        }

        updateGameState();

        if (result.handOver) {
            io.emit('hand-over', {
                scores: result.finalScores,
                teams: game.teams
            });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Utente disconnesso: ${socket.id}`);
        game.removePlayer(socket.id);
        updateGameState();
    });
});

function updateGameState() {
    const playerIds = Object.keys(game.players);
    const currentTurnPlayerId = playerIds[game.currentTurn] || null;

    io.emit('update-players', game.players);
    io.emit('update-table', game.table);
    io.emit('update-teams', game.teams);
    io.emit('update-turn', currentTurnPlayerId);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server avviato sulla porta ${PORT}`);
});
