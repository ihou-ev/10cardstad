"use client";

import { Player, getRevealedCards, getCurrentStrength, getFinalStrength } from "@/lib/game";
import { HAND_RANK_NAMES } from "@/lib/poker";
import { CardRow } from "./Card";
import { cn } from "@/lib/utils";

interface PlayerAreaProps {
  player: Player;
  isWeakest?: boolean;
  isWinner?: boolean;
  showFinalHand?: boolean;
  canSelectCard?: boolean;
  onSelectCard?: (cardId: string) => void;
}

export function PlayerArea({ player, isWeakest = false, isWinner = false, showFinalHand = false, canSelectCard = false, onSelectCard }: PlayerAreaProps) {
  const revealedCards = getRevealedCards(player);
  const currentHand = getCurrentStrength(player);
  const bestCards = new Set(currentHand.cards.map((c) => c.id));

  const finalHand = showFinalHand ? getFinalStrength(player) : null;
  const finalBestCards = finalHand ? new Set(finalHand.cards.map((c) => c.id)) : null;

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-4 transition-colors",
        isWinner
          ? "border-amber-400 bg-amber-950/50"
          : isWeakest
          ? "border-red-500 bg-red-950/30"
          : "border-slate-700 bg-slate-800/50"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-balance">{player.name}</h3>
        <div className="flex items-center gap-2">
          {isWinner && (
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-500 text-amber-950 rounded">
              勝者
            </span>
          )}
          {isWeakest && !isWinner && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-500 text-white rounded">
              最弱
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <CardRow
          cards={player.doorCards}
          label="ドアカード"
          size="sm"
          highlightCards={showFinalHand ? finalBestCards ?? undefined : bestCards}
        />

        {player.revealedHoleCards.length > 0 && (
          <CardRow
            cards={player.revealedHoleCards}
            label="公開済みホール"
            size="sm"
            highlightCards={showFinalHand ? finalBestCards ?? undefined : bestCards}
          />
        )}

        {player.holeCards.length > 0 && (
          <CardRow
            cards={player.holeCards}
            faceDown
            label={canSelectCard ? `公開するカードを選択 (${player.holeCards.length}枚)` : `未公開 (${player.holeCards.length}枚)`}
            size="sm"
            selectable={canSelectCard}
            onSelectCard={onSelectCard}
          />
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            {showFinalHand ? "最終役" : "現在の役"}
          </span>
          <span className="font-medium text-slate-200">
            {showFinalHand && finalHand
              ? HAND_RANK_NAMES[finalHand.rank]
              : HAND_RANK_NAMES[currentHand.rank]}
          </span>
        </div>
      </div>
    </div>
  );
}
