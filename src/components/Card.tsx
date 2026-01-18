"use client";

import { Card as CardType, SUIT_SYMBOLS, RANK_DISPLAY, isRedSuit } from "@/lib/cards";
import { cn } from "@/lib/utils";

interface CardProps {
  card: CardType;
  faceDown?: boolean;
  highlight?: boolean;
  selectable?: boolean;
  onSelect?: () => void;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-10 h-14 text-sm",
  md: "w-14 h-20 text-base",
  lg: "w-20 h-28 text-xl",
};

export function PlayingCard({ card, faceDown = false, highlight = false, selectable = false, onSelect, size = "md" }: CardProps) {
  const isRed = isRedSuit(card.suit);

  if (faceDown) {
    const baseClasses = cn(
      "rounded-lg border-2 flex items-center justify-center",
      sizeClasses[size],
      selectable
        ? "border-blue-500 bg-blue-900 cursor-pointer hover:border-blue-400 hover:bg-blue-800"
        : "border-slate-600 bg-slate-700"
    );

    if (selectable) {
      return (
        <button onClick={onSelect} className={baseClasses}>
          <div className="size-6 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-xs text-white">?</span>
          </div>
        </button>
      );
    }

    return (
      <div className={baseClasses}>
        <div className="size-6 rounded-full bg-slate-600" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border-2 bg-white flex flex-col items-center justify-center font-bold tabular-nums",
        sizeClasses[size],
        isRed ? "text-red-600" : "text-slate-900",
        highlight ? "border-amber-400 ring-2 ring-amber-400" : "border-slate-300"
      )}
    >
      <span className="leading-none">{RANK_DISPLAY[card.rank]}</span>
      <span className="leading-none">{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  );
}

interface CardRowProps {
  cards: CardType[];
  faceDown?: boolean;
  highlightCards?: Set<string>;
  selectable?: boolean;
  onSelectCard?: (cardId: string) => void;
  size?: "sm" | "md" | "lg";
  label?: string;
}

export function CardRow({ cards, faceDown = false, highlightCards, selectable = false, onSelectCard, size = "md", label }: CardRowProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
      )}
      <div className="flex gap-1">
        {cards.map((card) => (
          <PlayingCard
            key={card.id}
            card={card}
            faceDown={faceDown}
            highlight={highlightCards?.has(card.id)}
            selectable={selectable}
            onSelect={() => onSelectCard?.(card.id)}
            size={size}
          />
        ))}
      </div>
    </div>
  );
}
