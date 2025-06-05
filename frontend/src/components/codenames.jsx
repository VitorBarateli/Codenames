import React, { useState, useEffect, useRef } from 'react';
import './codenames.css';

const CodenamesGame = () => {
  const [ws, setWs] = useState(null);
  const [gameState, setGameState] = useState({
    players: [],
    gameBoard: [],
    currentTurn: 'blue',
    gamePhase: 'waiting',
    clue: null,
    clueCount: 0,
    remainingGuesses: 0,
    blueCards: 0,
    redCards: 0,
    winner: null
  });

  const [spymasterView, setSpymasterView] = useState([]);
  const [playerInfo, setPlayerInfo] = useState({
    name: '',
    team: 'blue',
    role: 'operative'
  });

  const [isConnected, setIsConnected] = useState(false);
  const [clueInput, setClueInput] = useState('');
  const [clueCountInput, setClueCountInput] = useState(1);
  const wsRef = useRef(null);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    const websocket = new WebSocket('ws://localhost:8080');
    wsRef.current = websocket;

    websocket.onopen = () => {
      console.log('Conectado ao servidor');
      setIsConnected(true);
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'gameState') {
          setGameState(data.data);
        } else if (data.type === 'spymasterView') {
          setSpymasterView(data.data);
        }
      } catch (error) {
        console.error('Erro ao processar mensagem:', error);
      }
    };

    websocket.onclose = () => {
      console.log('Conexão fechada');
      setIsConnected(false);
      setWs(null);
      setTimeout(connectWebSocket, 3000);
    };

    websocket.onerror = (error) => {
      console.error('Erro WebSocket:', error);
    };
  };

  const joinGame = () => {
    if (ws && playerInfo.name.trim()) {
      ws.send(JSON.stringify({
        type: 'join',
        playerId: `player_${Date.now()}`,
        name: playerInfo.name,
        team: playerInfo.team,
        role: playerInfo.role
      }));
    }
  };

  const newGame = () => {
    if (ws) {
      ws.send(JSON.stringify({ type: 'newGame' }));
    }
  };

  const giveClue = () => {
    if (ws && clueInput.trim() && clueCountInput > 0) {
      ws.send(JSON.stringify({
        type: 'giveClue',
        clue: clueInput.trim(),
        count: parseInt(clueCountInput)
      }));

      setClueInput('');
      setClueCountInput(1);
    }
  };

  const guessCard = (cardIndex) => {
    if (ws) {
      ws.send(JSON.stringify({
        type: 'guessCard',
        cardIndex
      }));
    }
  };

  const endTurn = () => {
    if (ws) {
      ws.send(JSON.stringify({ type: 'endTurn' }));
    }
  };

  const getCardClasses = (card, index) => {
    let classes = 'card';
    
    if (card.revealed) {
      switch (card.color) {
        case 'blue': 
          classes += ' card-blue-revealed';
          break;
        case 'red': 
          classes += ' card-red-revealed';
          break;
        case 'neutral': 
          classes += ' card-neutral-revealed';
          break;
        case 'assassin': 
          classes += ' card-assassin-revealed';
          break;
        default: 
          classes += ' card-default';
      }
    } else if (playerInfo.role === 'spymaster' && spymasterView[index]) {
      const spyCard = spymasterView[index];
      switch (spyCard.color) {
        case 'blue': 
          classes += ' card-blue-spy';
          break;
        case 'red': 
          classes += ' card-red-spy';
          break;
        case 'neutral': 
          classes += ' card-neutral-spy';
          break;
        case 'assassin': 
          classes += ' card-assassin-spy';
          break;
        default: 
          classes += ' card-default';
      }
    } else {
      classes += ' card-default';
    }

    return classes;
  };

  const hasSpymasterInTeam = (team) => {
    return gameState.players.some(player => player.team === team && player.role === 'spymaster');
  };

  const isSpymasterDisabled = () => {
    return hasSpymasterInTeam(playerInfo.team);
  };

  const currentPlayer = gameState.players.find(p => p.name === playerInfo.name);
  const isMyTurn = currentPlayer && currentPlayer.team === gameState.currentTurn;
  const canGuess = gameState.gamePhase === 'guessing' && isMyTurn && playerInfo.role === 'operative';
  const canGiveClue = gameState.gamePhase === 'clue' && isMyTurn && playerInfo.role === 'spymaster';
  const bluePlayers = gameState.players.filter(player => player.team === 'blue');
  const redPlayers = gameState.players.filter(player => player.team === 'red');

  if (!isConnected) {
    return (
      <div className="connecting-screen">
        <div className="connecting-text">Conectando ao servidor...</div>
      </div>
    );
  }

  if (!currentPlayer) {
    const spymasterButtonDisabled = isSpymasterDisabled();
    const spymasterTooltip = spymasterButtonDisabled ? 
      `Já existe um espião-chefe no time ${playerInfo.team === 'blue' ? 'azul' : 'vermelho'}` : '';

    return (
      <div className="login-screen">
        <div className="login-container">
          <h1 className="login-title">Codenames</h1>
          <div>
            <div className="form-group">
              <label className="form-label">Seu nome:</label>
              <input
                type="text"
                value={playerInfo.name}
                onChange={(e) => setPlayerInfo({...playerInfo, name: e.target.value})}
                className="form-input"
                placeholder="Digite seu nome"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Time:</label>
              <div className="button-group-full">
                <button
                  onClick={() => setPlayerInfo({...playerInfo, team: 'blue'})}
                  className={`btn ${playerInfo.team === 'blue' ? 'btn-blue' : 'btn-secondary'}`}
                >
                  Time Azul
                </button>

                <button
                  onClick={() => setPlayerInfo({...playerInfo, team: 'red'})}
                  className={`btn ${playerInfo.team === 'red' ? 'btn-red' : 'btn-secondary'}`}
                >
                  Time Vermelho
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Função:</label>
              <div className="button-group-full">
                <button
                  onClick={() => setPlayerInfo({...playerInfo, role: 'operative'})}
                  className={`btn ${playerInfo.role === 'operative' ? 'btn-green' : 'btn-secondary'}`}
                >
                  Agente
                </button>

                <button
                  onClick={() => !spymasterButtonDisabled && setPlayerInfo({...playerInfo, role: 'spymaster'})}
                  disabled={spymasterButtonDisabled}
                  className={`btn ${playerInfo.role === 'spymaster' ? 'btn-yellow' : 'btn-secondary'} ${spymasterButtonDisabled ? 'btn-disabled' : ''}`}
                  title={spymasterTooltip}
                >
                  👑 Espião-Chefe
                  {spymasterButtonDisabled && (
                    <span style={{fontSize: '0.8em', display: 'block', marginTop: '2px'}}>
                      (Ocupado)
                    </span>
                  )}
                </button>
              </div>
              {spymasterButtonDisabled && (
                <div className="form-warning">
                  ⚠️ Já existe um espião-chefe no time {playerInfo.team === 'blue' ? 'azul' : 'vermelho'}
                </div>
              )}
            </div>

            <button
              onClick={joinGame}
              disabled={!playerInfo.name.trim()}
              className="btn btn-gradient"
              style={{width: '100%'}}
            >
              ▶️ Entrar no Jogo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="codenames-container">
      <div className="game-wrapper">
        <div className="team-column">
          <div className="team-sidebar team-sidebar-blue">
            <div className="team-title team-title-blue">
              Time Azul
            </div>

            <div className="team-players">
              {bluePlayers.map((player, index) => (
                <div
                  key={index}
                  className={`team-player team-player-blue ${
                    gameState.currentTurn === 'blue' && 
                    ((gameState.gamePhase === 'clue' && player.role === 'spymaster') ||
                     (gameState.gamePhase === 'guessing' && player.role === 'operative'))
                      ? 'current-turn' : ''
                  }`}
                >
                  <div className="player-name">
                    {player.role === 'spymaster' && (
                      <span className="spymaster-crown">👑</span>
                    )}
                    {player.name}
                  </div>
                  <div className="player-role-badge">
                    {player.role === 'spymaster' ? 'Espião-Chefe' : 'Agente'}
                  </div>
                </div>
              ))}
            </div>

            <div className="team-score team-score-blue">
              <div className="score-label">Cartas Restantes</div>
              <div className="score-value">{gameState.blueCards}</div>
            </div>
          </div>

          <div className="sidebar-panel">
            <h3 className="sidebar-title">Status da Partida</h3>
            <div className="status-info">
              <div>
                <strong>Fase:</strong> {
                  gameState.gamePhase === 'clue' ? 'Aguardando dica' :
                  gameState.gamePhase === 'guessing' ? 'Adivinhando' :
                  gameState.gamePhase === 'finished' ? 'Finalizada' : 'Aguardando'
                }
              </div>
              {gameState.gamePhase === 'guessing' && (
                <div>
                  <strong>Tentativas restantes:</strong> {gameState.remainingGuesses}
                </div>
              )}
              <div>
                <strong>Seu time:</strong> 
                <span className={`${
                  currentPlayer.team === 'blue' ? 'team-blue' : 'team-red'
                }`} style={{marginLeft: '0.25rem', fontWeight: '700'}}>
                  {currentPlayer.team === 'blue' ? 'AZUL' : 'VERMELHO'}
                </span>
              </div>
              <div>
                <strong>Sua função:</strong> 
                <span className="role-highlight" style={{marginLeft: '0.25rem', fontWeight: '700'}}>
                  {currentPlayer.role === 'spymaster' ? 'ESPIÃO-CHEFE' : 'AGENTE'}
                </span>
              </div>
              {isMyTurn && (
                <div className="my-turn-indicator">
                  <div className="my-turn-text">
                    🎯 É a sua vez!
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="codenames-main">
          <div className="game-header">
            <div className="game-header-top">
              <h1 className="game-title">Codenames</h1>
              <button
                onClick={newGame}
                className="btn btn-new-game"
              >
                🔄 Nova Partida
              </button>
            </div>

            <div className="game-stats">
              <div className="stat-card stat-card-blue">
                <div className="stat-label">Time Azul</div>
                <div className="stat-value">{gameState.blueCards}</div>
              </div>
              <div className="stat-card stat-card-red">
                <div className="stat-label">Time Vermelho</div>
                <div className="stat-value">{gameState.redCards}</div>
              </div>
              <div className="stat-card stat-card-yellow">
                <div className="stat-label">Turno Atual</div>
                <div className={`stat-value ${
                  gameState.currentTurn === 'blue' ? 'stat-value-blue' : 'stat-value-red'
                }`}>
                  {gameState.currentTurn === 'blue' ? 'AZUL' : 'VERMELHO'}
                </div>
              </div>
            </div>
          </div>

          <div className="game-layout">
            <div>
              {gameState.winner && (
                <div className="winner-banner">
                  <h2 className="winner-title">
                    🎉 Time {gameState.winner === 'blue' ? 'Azul' : 'Vermelho'} Venceu! 🎉
                  </h2>
                </div>
              )}
              {gameState.clue && (
                <div className="clue-banner">
                  <div className="clue-text">
                    <strong>Dica:</strong> "{gameState.clue}" - {gameState.clueCount} palavra(s)
                  </div>
                  <div className="clue-info">
                    Tentativas restantes: {gameState.remainingGuesses}
                  </div>
                </div>
              )}
              <div className="game-board">
                {gameState.gameBoard.map((card, index) => (
                  <button
                    key={index}
                    onClick={() => canGuess && !card.revealed && guessCard(index)}
                    disabled={!canGuess || card.revealed}
                    className={getCardClasses(card, index)}
                  >
                    {card.word}
                  </button>
                ))}
              </div>
              {playerInfo.role === 'spymaster' && (
                <div className="control-panel">
                  <div className="control-header">
                    <h3 className="control-title">Dica do Espião-Chefe</h3>
                  </div>
                  {canGiveClue && (
                    <div className="clue-input-group">
                      <input
                        type="text"
                        value={clueInput}
                        onChange={(e) => setClueInput(e.target.value)}
                        placeholder="Digite a dica"
                        className="clue-input"
                      />
                      <input
                        type="number"
                        value={clueCountInput}
                        onChange={(e) => setClueCountInput(Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                        className="clue-count-input"
                      />
                      <button
                        onClick={giveClue}
                        disabled={!clueInput.trim()}
                        className="btn btn-green"
                      >
                        Dar Dica
                      </button>
                    </div>
                  )}
                </div>
              )}
              {canGuess && (
                <div className="control-panel">
                  <div className="text-center">
                    <button
                      onClick={endTurn}
                      className="btn btn-orange"
                      style={{padding: '0.5rem 1.5rem'}}
                    >
                      Passar a Vez
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="team-column">
          <div className="team-sidebar team-sidebar-red">
            <div className="team-title team-title-red">
              Time Vermelho
            </div>
            <div className="team-players">
              {redPlayers.map((player, index) => (
                <div
                  key={index}
                  className={`team-player team-player-red ${
                    gameState.currentTurn === 'red' && 
                    ((gameState.gamePhase === 'clue' && player.role === 'spymaster') ||
                     (gameState.gamePhase === 'guessing' && player.role === 'operative'))
                      ? 'current-turn' : ''
                  }`}
                >
                  <div className="player-name">
                    {player.role === 'spymaster' && (
                      <span className="spymaster-crown">👑</span>
                    )}
                    {player.name}
                  </div>
                  <div className="player-role-badge">
                    {player.role === 'spymaster' ? 'Espião-Chefe' : 'Agente'}
                  </div>
                </div>
              ))}
            </div>  
            <div className="team-score team-score-red">
              <div className="score-label">Cartas Restantes</div>
              <div className="score-value">{gameState.redCards}</div>
            </div>
          </div>

          <div className="sidebar-panel">
            <h3 className="sidebar-title">Como Jogar</h3>
            <div className="rules-info">
              <div><strong>Espião-Chefe:</strong> Dê dicas para seus agentes</div>
              <div><strong>Agentes:</strong> Adivinhem as palavras do seu time</div>
              <div><strong>Azul:</strong> 9 cartas para descobrir</div>
              <div><strong>Vermelho:</strong> 8 cartas para descobrir</div>
              <div><strong>⚠️ Assassino:</strong> Evite a carta preta!</div>
              <div><strong>🎯 Objetivo:</strong> Descubra todas as suas cartas primeiro</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodenamesGame;