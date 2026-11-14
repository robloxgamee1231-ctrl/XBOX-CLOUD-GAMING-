import React from 'react';
import { Gamepad2, Keyboard, Lock, ShoppingBag, Star } from 'lucide-react';
import { makePosterFallbackUri } from '../utils/posterFallback';
import type { CatalogProduct } from '../types';

interface GameCardProps {
  product: CatalogProduct;
  selected?: boolean;
  wishlisted?: boolean;
  playtimeSec?: number;
  subscription?: string;
  onFocus?: () => void;
  onClick: () => void;
  size?: 'normal' | 'compact';
}

function formatPlaytime(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function planLabel(plan: 0 | 1 | 2 | 3): string | null {
  if (plan === 1) return 'ESSENTIAL';
  if (plan === 2) return 'PREMIUM';
  if (plan === 3) return 'ULTIMATE';
  return null;
}

export const GameCard: React.FC<GameCardProps> = ({
  product,
  selected,
  wishlisted,
  playtimeSec = 0,
  onFocus,
  onClick,
  size = 'normal',
}) => {
  const dim = size === 'compact' ? 'w-full aspect-square' : 'w-44 h-44 sm:w-52 sm:h-52';
  const badge = planLabel(product.plan);
  const friends = product.friends ?? [];

  return (
    <button
      type="button"
      onMouseEnter={onFocus}
      onFocus={onFocus}
      onClick={onClick}
      className={`psbox-card ${dim} text-left group ${selected ? 'active' : ''}`}
      title={product.title}
    >
      <img
        src={product.tileUrl || product.posterUrl || product.heroUrl}
        alt={product.title}
        loading="lazy"
        onError={(e) => {
          const el = e.currentTarget;
          if (!el.dataset.fallback) {
            el.dataset.fallback = '1';
            el.src = makePosterFallbackUri(product.title, product.publisher);
          }
        }}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />

      {/* Subtle bottom vignette */}
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />

      {/* Top-left playtime */}
      {playtimeSec > 0 && (
        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/80 text-[11px] font-bold text-white">
          {formatPlaytime(playtimeSec)}
        </div>
      )}

      {/* Top-right wishlist & lock */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
        {!product.playable && !product.isFreeToPlay && !product.purchasable && (
          <span className="w-7 h-7 rounded-full bg-black/75 border border-white/15 flex items-center justify-center text-white/85">
            <Lock className="w-3.5 h-3.5" />
          </span>
        )}
        {wishlisted && (
          <span className="w-7 h-7 rounded-full bg-[#0a1423]/90 border border-sky-400/60 flex items-center justify-center text-sky-400">
            <Star className="w-3.5 h-3.5 fill-sky-400" />
          </span>
        )}
      </div>

      {/* Bottom badges */}
      <div className="absolute inset-x-2.5 bottom-2.5 flex items-end justify-between gap-1.5">
        <div className="min-w-0 flex items-center gap-1">
          {product.isFreeToPlay ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#107c10] text-[10px] font-bold text-white uppercase">
              <ShoppingBag className="w-3 h-3" />
              FREE
            </span>
          ) : !product.playable && product.purchasable ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#107c10] text-[10px] font-bold text-white">
              <ShoppingBag className="w-3 h-3" />
              {product.price?.formatted ?? 'BUY'}
            </span>
          ) : friends.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/85 border border-white/15 text-[11px] font-semibold text-white max-w-[125px] truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate">{friends[0].gamertag}</span>
            </span>
          ) : badge ? (
            <span className="px-2 py-0.5 rounded bg-black/80 text-[10px] font-bold text-white/90 tracking-wide">
              {badge}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span
            className="px-1.5 py-0.5 rounded bg-black/80 text-white/90 flex items-center justify-center"
            title={product.mouseKeyboard ? 'Mouse & Keyboard + Gamepad' : 'Gamepad'}
          >
            {product.mouseKeyboard ? (
              <Keyboard className="w-3.5 h-3.5" />
            ) : (
              <Gamepad2 className="w-3.5 h-3.5" />
            )}
          </span>
          {product.platform && (
            <span className="px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-white">
              {product.platform}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};
