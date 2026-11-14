import React from 'react';
import { ExternalLink, Eye, EyeOff, Gamepad2, Keyboard, Play, Smartphone, Star, X } from 'lucide-react';
import type { CatalogProduct } from '../types';
import { t, type LangCode } from '../i18n/translations';

interface GameDetailsModalProps {
  lang: LangCode;
  product: CatalogProduct;
  wishlisted: boolean;
  hidden: boolean;
  onToggleWishlist: () => void;
  onToggleHidden: () => void;
  onPlay: () => void;
  onClose: () => void;
}

export const GameDetailsModal: React.FC<GameDetailsModalProps> = ({
  lang,
  product,
  wishlisted,
  hidden,
  onToggleWishlist,
  onToggleHidden,
  onPlay,
  onClose,
}) => {
  const storeUrl = `https://www.xbox.com/games/store/game/${product.productId}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full rounded-3xl overflow-hidden bg-[#12161b] border border-white/15 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero art */}
        <div className="relative h-64 sm:h-80 w-full overflow-hidden">
          <img
            src={product.heroUrl || product.posterUrl || product.tileUrl}
            alt={product.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#12161b] via-[#12161b]/55 to-black/30" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/65 hover:bg-black text-white flex items-center justify-center border border-white/15 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-5 left-6 right-6 flex items-end gap-5">
            <img
              src={product.tileUrl || product.posterUrl}
              alt={product.title}
              className="hidden sm:block w-28 h-28 rounded-2xl object-cover border-2 border-white/20 shadow-xl shrink-0"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                {product.platform && (
                  <span className="px-2 py-0.5 rounded bg-white/15 text-[11px] font-bold">
                    {product.platform}
                  </span>
                )}
                {product.ratingAge && (
                  <span className="px-2 py-0.5 rounded border border-white/25 text-[11px] font-bold">
                    {product.ratingSystem ? `${product.ratingSystem}: ` : ''}
                    {product.ratingAge}
                  </span>
                )}
                {product.isFreeToPlay && (
                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-[11px] font-bold">
                    {t(lang, 'free')}
                  </span>
                )}
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-white leading-tight truncate">
                {product.title}
              </h2>
              {product.publisher && (
                <p className="text-sm text-[#b4bcc8] mt-0.5">By {product.publisher}</p>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            {product.playable || product.isFreeToPlay ? (
              <button type="button" onClick={onPlay} className="psbox-btn psbox-btn-primary px-7 py-3 text-base">
                <Play className="w-5 h-5 fill-white" />
                {t(lang, 'play')}
              </button>
            ) : (
              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                className="psbox-btn psbox-btn-primary px-7 py-3 text-base"
              >
                <ExternalLink className="w-4 h-4" />
                Buy on Xbox.com {product.price?.formatted ? `(${product.price.formatted})` : ''}
              </a>
            )}

            <button
              type="button"
              onClick={onToggleWishlist}
              className={`psbox-btn ${wishlisted ? 'border-sky-400/60 text-sky-300 bg-sky-500/15' : ''}`}
            >
              <Star className={`w-4 h-4 ${wishlisted ? 'fill-sky-400 text-sky-400' : ''}`} />
              {wishlisted ? 'Wishlisted' : 'Add to Wishlist'}
            </button>

            <button type="button" onClick={onToggleHidden} className="psbox-btn">
              {hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {hidden ? 'Show game' : 'Hide'}
            </button>

            <a href={storeUrl} target="_blank" rel="noreferrer" className="psbox-btn text-xs">
              <ExternalLink className="w-3.5 h-3.5" />
              Xbox Store
            </a>
          </div>

          {product.description && (
            <p className="text-sm text-[#b4bcc8] leading-relaxed max-w-3xl">{product.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10 text-xs text-[#9aa4b8]">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5">
              <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
              Controller Supported
            </span>
            {product.mouseKeyboard && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5">
                <Keyboard className="w-3.5 h-3.5 text-emerald-400" />
                Mouse &amp; Keyboard
              </span>
            )}
            {product.touch && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                Touch Controls
              </span>
            )}
            {product.categories.map((cat) => (
              <span key={cat} className="px-3 py-1.5 rounded-full bg-white/5">
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
