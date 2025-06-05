import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let WORDS = [];

function loadWords() {
  try {
    const wordsPath = join(__dirname, 'palavras.json');
    const wordsData = readFileSync(wordsPath, 'utf8');
    const parsed = JSON.parse(wordsData);
    WORDS = parsed.palavras;
    console.log(`${WORDS.length} palavras carregadas do arquivo JSON`);
  } catch (error) {
    console.error('Erro ao carregar palavras do JSON:', error);
    WORDS = [
      'AGUA', 'AMOR', 'ANJO', 'ARVORE', 'AVIAO', 'BALA', 'BANANA', 'BARCO', 'BICICLETA', 'BOLA',
      'BONECA', 'BORBOLETA', 'BRAÇO', 'CABELO', 'CACHORRO', 'CADEIRA', 'CAFE', 'CAMA', 'CAMERA', 'CANETA',
      'CARRO', 'CASA', 'CASTELO', 'CAVALO', 'CEREBRO', 'CHAVE', 'CHOCOLATE', 'CHUVA', 'CIDADE', 'CINEMA'
    ];
  }
}

loadWords();

let gameState = {
  players: new Map(),
  gameBoard: [],
  currentTurn: 'blue',
  gamePhase: 'waiting',
  clue: null,
  clueCount: 0,
  remainingGuesses: 0,
  blueCards: 0,
  redCards: 0,
  winner: null,
  spymasters: { blue: null, red: null }
};

function initializeGame() {
  if (WORDS.length < 25) {
    console.error('Não há palavras suficientes para iniciar o jogo (mínimo 25)');
    return;
  }

  // Seleciona 25 palavras aleatórias
  const shuffled = [...WORDS].sort(() => 0.5 - Math.random());
  const selectedWords = shuffled.slice(0, 25);

  // Define as cores das cartas (9 azuis, 8 vermelhas, 7 neutras, 1 preta)
  const colors = [
    ...Array(9).fill('blue'),
    ...Array(8).fill('red'),
    ...Array(7).fill('neutral'),
    'assassin'
  ].sort(() => 0.5 - Math.random());

  gameState.gameBoard = selectedWords.map((word, index) => ({
    word,
    color: colors[index],
    revealed: false
  }));

  gameState.blueCards = 9;
  gameState.redCards = 8;
  gameState.currentTurn = 'blue';
  gameState.gamePhase = 'clue';
  gameState.winner = null;
  gameState.clue = null;
  gameState.clueCount = 0;
  gameState.remainingGuesses = 0;
}

function broadcastGameState(wss) {
  const message = JSON.stringify({
    type: 'gameState',
    data: {
      ...gameState,
      players: Array.from(gameState.players.values()),
      gameBoard: gameState.gameBoard.map(card => ({
        ...card,
        // Só mostra a cor para spymasters
        colorVisible: card.revealed
      }))
    }
  });

  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

function broadcastSpymasterView(wss) {
  const spymasterMessage = JSON.stringify({
    type: 'spymasterView',
    data: gameState.gameBoard
  });

  wss.clients.forEach(client => {
    if (client.readyState === 1 && client.isSpymaster) {
      client.send(spymasterMessage);
    }
  });
}

function checkWinCondition() {
  if (gameState.blueCards === 0) {
    gameState.winner = 'blue';
    gameState.gamePhase = 'finished';
    return true;
  }
  if (gameState.redCards === 0) {
    gameState.winner = 'red';
    gameState.gamePhase = 'finished';
    return true;
  }
  return false;
}

// Função para verificar se já existe um espião-chefe no time
function hasSpymaster(team) {
  return gameState.spymasters[team] !== null;
}

// Função para remover jogador como espião-chefe
function removeSpymaster(playerId, team) {
  if (gameState.spymasters[team] === playerId) {
    gameState.spymasters[team] = null;
  }
}

const server = createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Nova conexão estabelecida');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'join':
          const playerId = data.playerId || `player_${Date.now()}`;
          const requestedTeam = data.team || 'blue';
          const requestedRole = data.role || 'operative';

          // Verifica se o jogador está tentando ser espião-chefe quando já existe um no time
          if (requestedRole === 'spymaster' && hasSpymaster(requestedTeam)) {
            ws.send(JSON.stringify({
              type: 'error',
              message: `Já existe um espião-chefe no time ${requestedTeam === 'blue' ? 'azul' : 'vermelho'}. Você foi definido como operativo.`
            }));

            // Force o jogador a ser operativo
            const player = {
              id: playerId,
              name: data.name || `Player ${gameState.players.size + 1}`,
              team: requestedTeam,
              role: 'operative'
            };

            gameState.players.set(playerId, player);
            ws.playerId = playerId;
            ws.isSpymaster = false;
          } else {
            const player = {
              id: playerId,
              name: data.name || `Player ${gameState.players.size + 1}`,
              team: requestedTeam,
              role: requestedRole
            };

            gameState.players.set(playerId, player);
            ws.playerId = playerId;
            ws.isSpymaster = player.role === 'spymaster';

            if (player.role === 'spymaster') {
              gameState.spymasters[player.team] = playerId;
            }
          }

          broadcastGameState(wss);
          if (ws.isSpymaster) {
            broadcastSpymasterView(wss);
          }
          break;

        case 'changeRole':
          if (ws.playerId && gameState.players.has(ws.playerId)) {
            const player = gameState.players.get(ws.playerId);
            const newRole = data.role;

            if (newRole === 'spymaster' && hasSpymaster(player.team)) {
              ws.send(JSON.stringify({
                type: 'error',
                message: `Já existe um espião-chefe no time ${player.team === 'blue' ? 'azul' : 'vermelho'}.`
              }));
            } else {
              if (player.role === 'spymaster') {
                removeSpymaster(ws.playerId, player.team);
              }

              player.role = newRole;
              ws.isSpymaster = newRole === 'spymaster';

              if (newRole === 'spymaster') {
                gameState.spymasters[player.team] = ws.playerId;
              }

              broadcastGameState(wss);
              if (ws.isSpymaster) {
                broadcastSpymasterView(wss);
              }
            }
          }
          break;

        case 'newGame':
          initializeGame();
          broadcastGameState(wss);
          broadcastSpymasterView(wss);
          break;

        case 'giveClue':
          if (gameState.gamePhase === 'clue' && ws.isSpymaster) {
            const player = gameState.players.get(ws.playerId);
            if (player && player.team === gameState.currentTurn) {
              gameState.clue = data.clue;
              gameState.clueCount = data.count;
              gameState.remainingGuesses = data.count + 1;
              gameState.gamePhase = 'guessing';
              broadcastGameState(wss);
            }
          }
          break;

        case 'guessCard':
          if (gameState.gamePhase === 'guessing' && !ws.isSpymaster) {
            const player = gameState.players.get(ws.playerId);
            if (player && player.team === gameState.currentTurn) {
              const card = gameState.gameBoard[data.cardIndex];
              if (!card.revealed) {
                card.revealed = true;

                if (card.color === 'assassin') {
                  gameState.winner = gameState.currentTurn === 'blue' ? 'red' : 'blue';
                  gameState.gamePhase = 'finished';
                } else if (card.color === gameState.currentTurn) {
                  if (gameState.currentTurn === 'blue') {
                    gameState.blueCards--;
                  } else {
                    gameState.redCards--;
                  }
                  gameState.remainingGuesses--;

                  if (!checkWinCondition() && gameState.remainingGuesses <= 0) {
                    gameState.currentTurn = gameState.currentTurn === 'blue' ? 'red' : 'blue';
                    gameState.gamePhase = 'clue';
                    gameState.clue = null;
                  }
                } else {
                  if (card.color === 'red') gameState.redCards--;
                  if (card.color === 'blue') gameState.blueCards--;

                  checkWinCondition();

                  if (gameState.gamePhase !== 'finished') {
                    gameState.currentTurn = gameState.currentTurn === 'blue' ? 'red' : 'blue';
                    gameState.gamePhase = 'clue';
                    gameState.clue = null;
                  }
                }

                broadcastGameState(wss);
              }
            }
          }
          break;

        case 'endTurn':
          if (gameState.gamePhase === 'guessing' && !ws.isSpymaster) {
            const player = gameState.players.get(ws.playerId);
            if (player && player.team === gameState.currentTurn) {
              gameState.currentTurn = gameState.currentTurn === 'blue' ? 'red' : 'blue';
              gameState.gamePhase = 'clue';
              gameState.clue = null;
              broadcastGameState(wss);
            }
          }
          break;

        case 'reloadWords':
          loadWords();
          ws.send(JSON.stringify({
            type: 'message',
            data: `Palavras recarregadas: ${WORDS.length} palavras disponíveis`
          }));
          break;
      }
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
    }
  });

  ws.on('close', () => {
    if (ws.playerId) {
      const player = gameState.players.get(ws.playerId);
      if (player && player.role === 'spymaster') {
        removeSpymaster(ws.playerId, player.team);
      }
      gameState.players.delete(ws.playerId);
      broadcastGameState(wss);
    }
    console.log('Conexão fechada');
  });

  broadcastGameState(wss);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Servidor WebSocket rodando na porta ${PORT}`);
  console.log(`Usando ${WORDS.length} palavras em português`);
});

initializeGame();