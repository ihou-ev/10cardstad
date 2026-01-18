import { Card, createDeck, shuffleDeck } from "./cards";
import { findBestHand, HandResult, compareHands } from "./poker";

export interface Player {
  id: number;
  name: string;
  doorCards: Card[]; // Always visible (5 cards)
  holeCards: Card[]; // Initially hidden (5 cards, decreases as revealed)
  revealedHoleCards: Card[]; // Hole cards that have been revealed
}

export interface GameState {
  players: Player[];
  deadCards: Card[]; // 2 unused cards
  phase: "dealing" | "revealing" | "showdown" | "finished";
  currentRound: number; // 0-4 for revealing rounds
  revealHistory: RevealEvent[];
  winner: Player[] | null;
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

export function initializeGame(playerNames: string[]): GameState {
  if (playerNames.length !== 5) {
    throw new Error("Game requires exactly 5 players");
  }

  const deck = shuffleDeck(createDeck());
  const players: Player[] = [];

  for (let i = 0; i < 5; i++) {
    const startIdx = i * 10;
    const doorCards = deck.slice(startIdx, startIdx + 5);
    const holeCards = deck.slice(startIdx + 5, startIdx + 10);

    players.push({
      id: i,
      name: playerNames[i],
      doorCards,
      holeCards,
      revealedHoleCards: [],
    });
  }

  const deadCards = deck.slice(50, 52);

  return {
    players,
    deadCards,
    phase: "revealing",
    currentRound: 0,
    revealHistory: [],
    winner: null,
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

export function revealCard(player: Player): Card {
  if (player.holeCards.length === 0) {
    throw new Error("No more hole cards to reveal");
  }

  // Reveal the first hole card (random since deck was shuffled)
  const card = player.holeCards[0];
  player.holeCards = player.holeCards.slice(1);
  player.revealedHoleCards = [...player.revealedHoleCards, card];

  return card;
}

export function processRevealRound(state: GameState): GameState {
  if (state.phase !== "revealing") {
    return state;
  }

  const weakestPlayers = findWeakestPlayers(state.players);

  if (weakestPlayers.length === 0) {
    // All players have revealed all hole cards
    return {
      ...state,
      phase: "showdown",
    };
  }

  const revealedCards: { playerId: number; card: Card }[] = [];

  // Create new player array with revealed cards
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

  // Check if all hole cards are revealed
  const allRevealed = newPlayers.every((p) => p.holeCards.length === 0);

  return {
    ...state,
    players: newPlayers,
    currentRound: state.currentRound + 1,
    revealHistory: [...state.revealHistory, event],
    phase: allRevealed ? "showdown" : "revealing",
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

  // Find the maximum strength
  let maxStrength = finalStrengths[0].strength.strength;
  for (const s of finalStrengths) {
    if (s.strength.strength > maxStrength) {
      maxStrength = s.strength.strength;
    }
  }

  // Find all players with maximum strength (could be ties)
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

  // Run all reveal rounds
  while (currentState.phase === "revealing") {
    currentState = processRevealRound(currentState);
  }

  // Determine winner
  if (currentState.phase === "showdown") {
    currentState = determineWinner(currentState);
  }

  return currentState;
}
