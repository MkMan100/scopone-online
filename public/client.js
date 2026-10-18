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

// Elementi per modale punteggi e banner scopa
const scoreModal = document.getElementById('score-modal');
const scoreBreakdown = document.getElementById('score-breakdown');
const scopaAnnouncement = document.getElementById('scopa-announcement');

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

// Mostra la scritta animata SCOPA!
socket.on('scopa-made', () => {
    if (scopaAnnouncement) {
        scopaAnnouncement.style.display = 'block';
        setTimeout(() => {
            scopaAnnouncement.style.display = 'none';
        }, 2500);
    }
});

// Mostra i punteggi dettagliati a fine mano
socket.on('hand-over', (data) => {
    const s1 = data.scores.team1;
    const s2 = data.scores.team2;

    if (scoreBreakdown && scoreModal) {
        scoreBreakdown.innerHTML = `
            <div style="display: flex; justify-content: space-around; text-align: left;">
                <div>
                    <h3>Squadra 1</h3>
                    <p>Scope: ${s1.scope}</p>
                    <p>Denari: ${s1.denari} (${s1.denariTotal}/10)</p>
                    <p>Carte: ${s1.carte} (${s1.carteTotal} carte)</p>
                    <p>Settebello: ${s1.settebello}</p>
                    <p>Primiera: ${s1.primiera}</p>
                    <h4>Totale: ${s1.total}</h4>
                </div>
                <div>
                    <h3>Squadra 2</h3>
                    <p>Scope: ${s2.scope}</p>
                    <p>Denari: ${s2.denari} (${s2.denariTotal}/10)</p>
                    <p>Carte: ${s2.carte} (${s2.carteTotal} carte)</p>
                    <p>Settebello: ${s2.settebello}</p>
                    <p>Primiera: ${s2.primiera}</p>
                    <h4>Totale: ${s2.total}</h4>
                </div>
            </div>
        `;
        scoreModal.style.display = 'flex';
    }
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
