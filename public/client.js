// public/client.js
const socket = io();

let myId = null;
let selectedCard = null;
let selectedTableCards = [];
let isMyTurn = false;
let playersData = {};

const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const playerCountSpan = document.getElementById('player-count');
const tableContainer = document.getElementById('table-cards');
const myHandContainer = document.getElementById('my-hand');
const myNameSpan = document.getElementById('my-name');
const myTeamSpan = document.getElementById('my-team');
const playBtn = document.getElementById('play-btn');
const turnInfo = document.getElementById('turn-info');

joinBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (!name) return alert('Inserisci un nome valido!');
    
    socket.emit('join-game', name);
    loginScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    myNameSpan.innerText = name;
});

socket.on('update-players', (players) => {
    if (!myId && socket.id) myId = socket.id;
    playersData = players;
    
    playerCountSpan.innerText = Object.keys(players).length;

    if (players[myId]) {
        myTeamSpan.innerText = `Squadra ${players[myId].team}`;
        renderHand(players[myId].hand);
    }
});

socket.on('update-turn', (currentTurnPlayerId) => {
    if (Object.keys(playersData).length < 4) {
        turnInfo.innerText = `In attesa di altri giocatori (${Object.keys(playersData).length}/4)...`;
        isMyTurn = false;
        return;
    }

    isMyTurn = (currentTurnPlayerId === myId);

    if (isMyTurn) {
        turnInfo.innerText = "È il tuo turno!";
        turnInfo.style.color = "#27ae60";
        turnInfo.style.fontWeight = "bold";
    } else {
        const currentPlayer = playersData[currentTurnPlayerId];
        const currentName = currentPlayer ? currentPlayer.name : "un avversario";
        turnInfo.innerText = `Turno di: ${currentName}`;
        turnInfo.style.color = "#c0392b";
        turnInfo.style.fontWeight = "normal";
    }
});

socket.on('update-table', (tableCards) => {
    renderTable(tableCards);
});

socket.on('error-message', (msg) => {
    alert(msg);
});

socket.on('hand-over', (data) => {
    let msg = "Mano terminata!\n\nRisultati:\n";
    msg += `Squadra 1 - Punti: ${data.scores[1]} (Scope: ${data.teams[1].scope})\n`;
    msg += `Squadra 2 - Punti: ${data.scores[2]} (Scope: ${data.teams[2].scope})\n`;
    alert(msg);
});

function renderHand(hand) {
    myHandContainer.innerHTML = '';
    hand.forEach(card => {
        const cardEl = createCardElement(card);
        cardEl.addEventListener('click', () => {
            if (!isMyTurn) {
                alert("Non è il tuo turno!");
                return;
            }

            document.querySelectorAll('#my-hand .card').forEach(c => c.classList.remove('selected'));
            cardEl.classList.add('selected');
            selectedCard = card;
            playBtn.disabled = false;
        });
        myHandContainer.appendChild(cardEl);
    });
}

function renderTable(tableCards) {
    tableContainer.innerHTML = '';
    tableCards.forEach(card => {
        const cardEl = createCardElement(card);
        cardEl.addEventListener('click', () => {
            if (!isMyTurn) return;

            cardEl.classList.toggle('selected');
            const cardId = card.id;
            if (selectedTableCards.includes(cardId)) {
                selectedTableCards = selectedTableCards.filter(id => id !== cardId);
            } else {
                selectedTableCards.push(cardId);
            }
        });
        tableContainer.appendChild(cardEl);
    });
}

function createCardElement(card) {
    const div = document.createElement('div');
    div.className = `card ${card.suit}`;
    div.setAttribute('data-value', card.value);
    div.innerHTML = `
        <span>${card.value}</span>
        <span style="font-size: 10px; text-align: center;">${card.suit[0].toUpperCase()}</span>
        <span style="align-self: flex-end;">${card.value}</span>
    `;
    return div;
}

playBtn.addEventListener('click', () => {
    if (!isMyTurn) {
        alert("Non è il tuo turno!");
        return;
    }
    if (!selectedCard) return;

    socket.emit('play-card', {
        cardId: selectedCard.id,
        targetCardIds: selectedTableCards
    });

    selectedCard = null;
    selectedTableCards = [];
    playBtn.disabled = true;
});