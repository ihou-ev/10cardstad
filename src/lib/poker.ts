import { Card, Rank } from "./cards";

export type HandRank =
  | "straight-flush"
  | "four-of-a-kind"
  | "full-house"
  | "flush"
  | "straight"
  | "three-of-a-kind"
  | "two-pair"
  | "one-pair"
  | "high-card";

export const HAND_RANK_VALUES: Record<HandRank, number> = {
  "straight-flush": 8,
  "four-of-a-kind": 7,
  "full-house": 6,
  flush: 5,
  straight: 4,
  "three-of-a-kind": 3,
  "two-pair": 2,
  "one-pair": 1,
  "high-card": 0,
};

export const HAND_RANK_NAMES: Record<HandRank, string> = {
  "straight-flush": "ストレートフラッシュ",
  "four-of-a-kind": "フォーカード",
  "full-house": "フルハウス",
  flush: "フラッシュ",
  straight: "ストレート",
  "three-of-a-kind": "スリーカード",
  "two-pair": "ツーペア",
  "one-pair": "ワンペア",
  "high-card": "ハイカード",
};

export interface HandResult {
  rank: HandRank;
  cards: Card[];
  kickers: number[]; // For tie-breaking
  strength: number; // Overall numeric strength for comparison
}

function getRankCounts(cards: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
  }
  return counts;
}

function isFlush(cards: Card[]): boolean {
  const suit = cards[0].suit;
  return cards.every((c) => c.suit === suit);
}

function isStraight(cards: Card[]): { isStraight: boolean; highCard: number } {
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);

  // Check for A-2-3-4-5 (wheel)
  if (
    ranks[0] === 2 &&
    ranks[1] === 3 &&
    ranks[2] === 4 &&
    ranks[3] === 5 &&
    ranks[4] === 14
  ) {
    return { isStraight: true, highCard: 5 }; // 5-high straight (lowest)
  }

  // Check for regular straight
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) {
      return { isStraight: false, highCard: 0 };
    }
  }
  return { isStraight: true, highCard: ranks[4] };
}

function calculateStrength(
  handRank: HandRank,
  kickers: number[]
): number {
  // Base strength from hand rank
  let strength = HAND_RANK_VALUES[handRank] * 10000000000;

  // Add kicker values (each kicker contributes less than the previous)
  for (let i = 0; i < kickers.length && i < 5; i++) {
    strength += kickers[i] * Math.pow(15, 4 - i);
  }

  return strength;
}

export function evaluateHand(cards: Card[]): HandResult {
  if (cards.length !== 5) {
    throw new Error("Hand must have exactly 5 cards");
  }

  const rankCounts = getRankCounts(cards);
  const counts = Array.from(rankCounts.entries())
    .sort((a, b) => {
      // Sort by count desc, then by rank desc
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0] - a[0];
    });

  const flush = isFlush(cards);
  const straight = isStraight(cards);

  // Straight Flush
  if (flush && straight.isStraight) {
    return {
      rank: "straight-flush",
      cards,
      kickers: [straight.highCard],
      strength: calculateStrength("straight-flush", [straight.highCard]),
    };
  }

  // Four of a Kind
  if (counts[0][1] === 4) {
    const fourRank = counts[0][0];
    const kicker = counts[1][0];
    return {
      rank: "four-of-a-kind",
      cards,
      kickers: [fourRank, kicker],
      strength: calculateStrength("four-of-a-kind", [fourRank, kicker]),
    };
  }

  // Full House
  if (counts[0][1] === 3 && counts[1][1] === 2) {
    const threeRank = counts[0][0];
    const pairRank = counts[1][0];
    return {
      rank: "full-house",
      cards,
      kickers: [threeRank, pairRank],
      strength: calculateStrength("full-house", [threeRank, pairRank]),
    };
  }

  // Flush
  if (flush) {
    const kickers = cards.map((c) => c.rank).sort((a, b) => b - a);
    return {
      rank: "flush",
      cards,
      kickers,
      strength: calculateStrength("flush", kickers),
    };
  }

  // Straight
  if (straight.isStraight) {
    return {
      rank: "straight",
      cards,
      kickers: [straight.highCard],
      strength: calculateStrength("straight", [straight.highCard]),
    };
  }

  // Three of a Kind
  if (counts[0][1] === 3) {
    const threeRank = counts[0][0];
    const kickers = [threeRank, counts[1][0], counts[2][0]];
    return {
      rank: "three-of-a-kind",
      cards,
      kickers,
      strength: calculateStrength("three-of-a-kind", kickers),
    };
  }

  // Two Pair
  if (counts[0][1] === 2 && counts[1][1] === 2) {
    const highPair = Math.max(counts[0][0], counts[1][0]);
    const lowPair = Math.min(counts[0][0], counts[1][0]);
    const kicker = counts[2][0];
    return {
      rank: "two-pair",
      cards,
      kickers: [highPair, lowPair, kicker],
      strength: calculateStrength("two-pair", [highPair, lowPair, kicker]),
    };
  }

  // One Pair
  if (counts[0][1] === 2) {
    const pairRank = counts[0][0];
    const kickers = [pairRank, counts[1][0], counts[2][0], counts[3][0]];
    return {
      rank: "one-pair",
      cards,
      kickers,
      strength: calculateStrength("one-pair", kickers),
    };
  }

  // High Card
  const kickers = cards.map((c) => c.rank).sort((a, b) => b - a);
  return {
    rank: "high-card",
    cards,
    kickers,
    strength: calculateStrength("high-card", kickers),
  };
}

// Generate all combinations of k elements from array
function combinations<T>(array: T[], k: number): T[][] {
  const result: T[][] = [];

  function backtrack(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < array.length; i++) {
      current.push(array[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }

  backtrack(0, []);
  return result;
}

export function findBestHand(cards: Card[]): HandResult {
  if (cards.length < 5) {
    throw new Error("Need at least 5 cards to evaluate");
  }

  if (cards.length === 5) {
    return evaluateHand(cards);
  }

  // Find the best 5-card combination
  const allCombinations = combinations(cards, 5);
  let bestHand: HandResult | null = null;

  for (const combo of allCombinations) {
    const hand = evaluateHand(combo);
    if (!bestHand || hand.strength > bestHand.strength) {
      bestHand = hand;
    }
  }

  return bestHand!;
}

export function compareHands(a: HandResult, b: HandResult): number {
  return a.strength - b.strength;
}
