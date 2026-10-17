// server/game.js

class ScoponeGame {
    constructor() {
        this.resetGame();
    }

    resetGame() {
        this.deck = this.createDeck();
        this.table = [];
        this.players = {}; // ID -> { hand: [], points: 0, captures: [] }
        this.teams = { 
            1: { players: [], captures: [], score: 0, scope: 0 }, 
            2: { players: [], captures: [], score: 0, scope: 0 } 
        };
        this.currentTurn = 0;
        this.dealerIndex = 0;
        this.gameStarted = false;
    }

    createDeck() {
        const suits = ['denari', 'coppe', 'spade', 'bastoni'];
        let deck = [];
        for (let suit of suits) {
            for (let value = 1; value <= 10; value++) {
                deck.push({ value, suit, id: `${suit}_${value}` });
            }
        }
        return this.shuffle(deck);
    }

    shuffle(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    addPlayer(socketId, name) {
        if (Object.keys(this.players).length >= 4) return false;
        
        const teamId = (Object.keys(this.players).length % 2 === 0) ? 1 : 2;
        
        this.players[socketId] = {
            id: socketId,
            name: name,
            hand: [],
            captures: [],
            team: teamId
        };

        if (!this.teams[teamId].players.includes(socketId)) {
            this.teams[teamId].players.push(socketId);
        }

        return true;
    }

    removePlayer(socketId) {
        if (this.players[socketId]) {
            const teamId = this.players[socketId].team;
            this.teams[teamId].players = this.teams[teamId].players.filter(id => id !== socketId);
            delete this.players[socketId];
            this.gameStarted = false;
        }
    }

    isReadyToStart() {
        return Object.keys(this.players).length === 4;
    }

    startNewHand() {
        if (!this.isReadyToStart()) return;

        this.deck = this.createDeck();
        this.table = []; // Tavolo inizialmente vuoto
        
        Object.values(this.teams).forEach(t => {
            t.captures = [];
            t.scope = 0;
        });
        Object.values(this.players).forEach(p => p.captures = []);

        // Distribuisce 10 carte a tutti e 4 i giocatori (40 carte totali)
        Object.keys(this.players).forEach(id => {
            this.players[id].hand = this.deck.splice(0, 10);
        });

        this.currentTurn = 0;
        this.gameStarted = true;
    }

    playCard(playerId, cardId, targetCardIds = []) {
        const playerIds = Object.keys(this.players);
        
        if (playerIds[this.currentTurn] !== playerId) {
            return { success: false, message: "Non è il tuo turno!" };
        }

        const player = this.players[playerId];
        if (!player) return { success: false, message: "Giocatore non trovato" };

        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return { success: false, message: "Carta non in mano" };

        const card = player.hand[cardIndex];

        const captureResult = this.validateAndExecuteCapture(card, targetCardIds, player);
        if (!captureResult.success) {
            return { success: false, message: captureResult.message };
        }

        player.hand.splice(cardIndex, 1);

        this.currentTurn = (this.currentTurn + 1) % 4;

        let isScopa = false;
        const handOver = Object.values(this.players).every(p => p.hand.length === 0);

        if (this.table.length === 0 && !handOver) {
            isScopa = true;
            this.teams[player.team].scope++;
        }

        let finalScores = null;
        if (handOver) {
            finalScores = this.calculateScore();
        }

        return {
            success: true,
            card,
            isScopa,
            table: this.table,
            nextTurnPlayerId: playerIds[this.currentTurn],
            handOver,
            finalScores
        };
    }

    validateAndExecuteCapture(card, targetCardIds, player) {
        if (targetCardIds.length === 0) {
            const hasValidCaptureAvailable = this.checkIfCaptureIsPossible(card, this.table);
            if (hasValidCaptureAvailable) {
                return { success: false, message: "Esiste una presa valida sul tavolo! Sei obbligato a prendere." };
            }

            this.table.push(card);
            return { success: true };
        }

        const targetCards = this.table.filter(c => targetCardIds.includes(c.id));
        if (targetCards.length !== targetCardIds.length) {
            return { success: false, message: "Carte sul tavolo non valide" };
        }

        const targetSum = targetCards.reduce((sum, c) => sum + c.value, 0);

        if (targetCards.length === 1 && targetCards[0].value === card.value) {
            this.executeCapture(player, card, targetCards);
            return { success: true };
        } else if (targetSum === card.value) {
            this.executeCapture(player, card, targetCards);
            return { success: true };
        } else {
            return { success: false, message: "Presa non valida secondo le regole" };
        }
    }

    checkIfCaptureIsPossible(card, tableCards) {
        const canSingleCapture = tableCards.some(c => c.value === card.value);
        if (canSingleCapture) return true;
        return this.findSumCombinations(tableCards, card.value);
    }

    findSumCombinations(arr, target) {
        function helper(start, currentSum, currentComb) {
            if (currentSum === target && currentComb.length > 0) return true;
            if (currentSum >= target) return false;
            for (let i = start; i < arr.length; i++) {
                if (helper(i + 1, currentSum + arr[i].value, [...currentComb, arr[i]])) return true;
            }
            return false;
        }
        return helper(0, 0, []);
    }

    executeCapture(player, playedCard, targetCards) {
        const targetIds = targetCards.map(c => c.id);
        this.table = this.table.filter(c => !targetIds.includes(c.id));

        player.captures.push(playedCard, ...targetCards);
        this.teams[player.team].captures.push(playedCard, ...targetCards);
    }

    calculatePrimieraForTeam(captures) {
        const suits = ['denari', 'coppe', 'spade', 'bastoni'];
        const primieraValues = {
            1: 16, 2: 12, 3: 13, 4: 14, 5: 15,
            6: 18, 7: 21, 8: 10, 9: 10, 10: 10
        };

        let totalPrimiera = 0;

        for (let suit of suits) {
            const suitCards = captures.filter(c => c.suit === suit);
            if (suitCards.length === 0) return 0; 

            let maxValForSuit = 0;
            for (let card of suitCards) {
                const pVal = primieraValues[card.value] || 0;
                if (pVal > maxValForSuit) maxValForSuit = pVal;
            }
            totalPrimiera += maxValForSuit;
        }

        return totalPrimiera;
    }

    calculateScore() {
        let scores = { 1: 0, 2: 0 };
        
        const team1Captures = this.teams[1].captures;
        const team2Captures = this.teams[2].captures;

        // Scope
        scores[1] += this.teams[1].scope;
        scores[2] += this.teams[2].scope;

        // Carte (> 20)
        if (team1Captures.length > 20) scores[1] += 1;
        else if (team2Captures.length > 20) scores[2] += 1;

        // Denari (> 5)
        const denari1 = team1Captures.filter(c => c.suit === 'denari').length;
        const denari2 = team2Captures.filter(c => c.suit === 'denari').length;
        if (denari1 > 5) scores[1] += 1;
        else if (denari2 > 5) scores[2] += 1;

        // Settebello
        const hasSettebello1 = team1Captures.some(c => c.suit === 'denari' && c.value === 7);
        if (hasSettebello1) scores[1] += 1;
        else scores[2] += 1;

        // Primiera
        const primiera1 = this.calculatePrimieraForTeam(team1Captures);
        const primiera2 = this.calculatePrimieraForTeam(team2Captures);
        
        if (primiera1 > 0 && primiera1 > primiera2) {
            scores[1] += 1;
        } else if (primiera2 > 0 && primiera2 > primiera1) {
            scores[2] += 1;
        }

        return scores;
    }
}

module.exports = ScoponeGame;