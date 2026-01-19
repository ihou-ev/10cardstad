import { Card, createDeck, shuffleDeck } from "./cards";
import { findBestHand, HandResult } from "./poker";

export type Difficulty = "normal" | "hard" | "hell" | "nightmare";

export interface DifficultyConfig {
  name: string;
  holeCards: number;
  doorCards: number;
  description: string;
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  normal: {
    name: "ノーマル",
    holeCards: 5,
    doorCards: 5,
    description: "隠し札5枚",
  },
  hard: {
    name: "ハード",
    holeCards: 4,
    doorCards: 6,
    description: "隠し札4枚",
  },
  hell: {
    name: "ヘル",
    holeCards: 2,
    doorCards: 8,
    description: "隠し札2枚",
  },
  nightmare: {
    name: "ナイトメア",
    holeCards: 0,
    doorCards: 5,
    description: "隠し札なし",
  },
};

export interface Player {
  id: number;
  name: string;
  doorCards: Card[]; // Always visible (5 cards)
  holeCards: Card[]; // Initially hidden (5 cards, decreases as revealed)
  revealedHoleCards: Card[]; // Hole cards that have been revealed
}

export interface GameState {
  players: Player[];
  deadCards: Card[]; // Unused cards
  phase: "dealing" | "revealing" | "showdown" | "finished";
  currentRound: number;
  revealHistory: RevealEvent[];
  winner: Player[] | null;
  waitingForPlayers: number[]; // Players who need to select a card to reveal
}

export interface RevealEvent {
  round: number;
  playerIds: number[];
  cards: { playerId: number; card: Card }[];
}

export function getRevealedCards(player: Player): Card[] {
  return [...player.doorCards, ...player.revealedHoleCards];
}

export function getAllCards(player: Player): Card[] {
  return [...player.doorCards, ...player.revealedHoleCards, ...player.holeCards];
}

export function getCurrentStrength(player: Player): HandResult {
  const revealed = getRevealedCards(player);
  return findBestHand(revealed);
}

export function getFinalStrength(player: Player): HandResult {
  const all = getAllCards(player);
  return findBestHand(all);
}

export function initializeGame(playerNames: string[], difficulty: Difficulty = "normal"): GameState {
  const playerCount = playerNames.length;
  if (playerCount < 2 || playerCount > 5) {
    throw new Error("Game requires 2-5 players");
  }

  const playerConfig = DIFFICULTY_CONFIGS[difficulty];
  const normalConfig = DIFFICULTY_CONFIGS["normal"];

  const deck = shuffleDeck(createDeck());
  const players: Player[] = [];
  let cardIndex = 0;

  for (let i = 0; i < playerCount; i++) {
    // Player 0 uses selected difficulty, others use normal
    const config = i === 0 ? playerConfig : normalConfig;
    const doorCards = deck.slice(cardIndex, cardIndex + config.doorCards);
    cardIndex += config.doorCards;
    const holeCards = deck.slice(cardIndex, cardIndex + config.holeCards);
    cardIndex += config.holeCards;

    players.push({
      id: i,
      name: playerNames[i],
      doorCards,
      holeCards,
      revealedHoleCards: [],
    });
  }

  // Remaining cards are dead cards
  const deadCards = deck.slice(cardIndex);

  // If player has no hole cards (nightmare mode), check if all players have no hole cards
  // Actually, only player 0 might have no hole cards, others always have 5
  // So we stay in revealing phase unless it's a special case
  const initialPhase = "revealing";

  return {
    players,
    deadCards,
    phase: initialPhase,
    currentRound: 0,
    revealHistory: [],
    winner: null,
    waitingForPlayers: [],
  };
}

export function findWeakestPlayers(players: Player[]): Player[] {
  // Only consider players who still have hole cards
  const playersWithHoleCards = players.filter((p) => p.holeCards.length > 0);

  if (playersWithHoleCards.length === 0) {
    return [];
  }

  // Calculate current strength for each player
  const strengths = playersWithHoleCards.map((p) => ({
    player: p,
    strength: getCurrentStrength(p),
  }));

  // Find the minimum strength
  let minStrength = strengths[0].strength.strength;
  for (const s of strengths) {
    if (s.strength.strength < minStrength) {
      minStrength = s.strength.strength;
    }
  }

  // Return all players with minimum strength
  return strengths
    .filter((s) => s.strength.strength === minStrength)
    .map((s) => s.player);
}

// Start a reveal round - returns players who need to select a card
export function startRevealRound(state: GameState): GameState {
  if (state.phase !== "revealing") {
    return state;
  }

  const weakestPlayers = findWeakestPlayers(state.players);

  if (weakestPlayers.length === 0) {
    return {
      ...state,
      phase: "showdown",
      waitingForPlayers: [],
    };
  }

  return {
    ...state,
    waitingForPlayers: weakestPlayers.map((p) => p.id),
  };
}

// Player selects which card to reveal
export function revealSelectedCard(
  state: GameState,
  playerId: number,
  cardId: string
): GameState {
  if (state.phase !== "revealing") {
    return state;
  }

  if (!state.waitingForPlayers.includes(playerId)) {
    return state;
  }

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return state;

  const player = state.players[playerIndex];
  const cardIndex = player.holeCards.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return state;

  const card = player.holeCards[cardIndex];
  const newHoleCards = player.holeCards.filter((c) => c.id !== cardId);
  const newRevealedHoleCards = [...player.revealedHoleCards, card];

  const newPlayers = [...state.players];
  newPlayers[playerIndex] = {
    ...player,
    holeCards: newHoleCards,
    revealedHoleCards: newRevealedHoleCards,
  };

  const newWaitingForPlayers = state.waitingForPlayers.filter((id) => id !== playerId);

  // Add to reveal history
  const existingEvent = state.revealHistory.find((e) => e.round === state.currentRound);
  let newRevealHistory: RevealEvent[];

  if (existingEvent) {
    newRevealHistory = state.revealHistory.map((e) =>
      e.round === state.currentRound
        ? {
            ...e,
            playerIds: [...e.playerIds, playerId],
            cards: [...e.cards, { playerId, card }],
          }
        : e
    );
  } else {
    newRevealHistory = [
      ...state.revealHistory,
      {
        round: state.currentRound,
        playerIds: [playerId],
        cards: [{ playerId, card }],
      },
    ];
  }

  // Check if all waiting players have revealed
  if (newWaitingForPlayers.length === 0) {
    // Check if all hole cards are revealed
    const allRevealed = newPlayers.every((p) => p.holeCards.length === 0);

    return {
      ...state,
      players: newPlayers,
      revealHistory: newRevealHistory,
      waitingForPlayers: [],
      currentRound: state.currentRound + 1,
      phase: allRevealed ? "showdown" : "revealing",
    };
  }

  return {
    ...state,
    players: newPlayers,
    revealHistory: newRevealHistory,
    waitingForPlayers: newWaitingForPlayers,
  };
}

// Legacy function for auto-reveal (used in local mode)
export function processRevealRound(state: GameState): GameState {
  if (state.phase !== "revealing") {
    return state;
  }

  const weakestPlayers = findWeakestPlayers(state.players);

  if (weakestPlayers.length === 0) {
    return {
      ...state,
      phase: "showdown",
    };
  }

  const revealedCards: { playerId: number; card: Card }[] = [];

  const newPlayers = state.players.map((player) => {
    if (weakestPlayers.some((wp) => wp.id === player.id)) {
      if (player.holeCards.length > 0) {
        const card = player.holeCards[0];
        revealedCards.push({ playerId: player.id, card });
        return {
          ...player,
          holeCards: player.holeCards.slice(1),
          revealedHoleCards: [...player.revealedHoleCards, card],
        };
      }
    }
    return player;
  });

  const event: RevealEvent = {
    round: state.currentRound,
    playerIds: weakestPlayers.map((p) => p.id),
    cards: revealedCards,
  };

  const allRevealed = newPlayers.every((p) => p.holeCards.length === 0);

  return {
    ...state,
    players: newPlayers,
    currentRound: state.currentRound + 1,
    revealHistory: [...state.revealHistory, event],
    phase: allRevealed ? "showdown" : "revealing",
    waitingForPlayers: [],
  };
}

export function determineWinner(state: GameState): GameState {
  if (state.phase !== "showdown") {
    return state;
  }

  const finalStrengths = state.players.map((p) => ({
    player: p,
    strength: getFinalStrength(p),
  }));

  let maxStrength = finalStrengths[0].strength.strength;
  for (const s of finalStrengths) {
    if (s.strength.strength > maxStrength) {
      maxStrength = s.strength.strength;
    }
  }

  const winners = finalStrengths
    .filter((s) => s.strength.strength === maxStrength)
    .map((s) => s.player);

  return {
    ...state,
    phase: "finished",
    winner: winners,
  };
}

export function runFullGame(state: GameState): GameState {
  let currentState = state;

  while (currentState.phase === "revealing") {
    currentState = processRevealRound(currentState);
  }

  if (currentState.phase === "showdown") {
    currentState = determineWinner(currentState);
  }

  return currentState;
}
