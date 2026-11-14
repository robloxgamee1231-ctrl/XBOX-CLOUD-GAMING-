import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ExternalLink, Eye, EyeOff, Heart, Lock, Play, ShoppingBag, Sliders, Star, X } from 'lucide-react';
import { makePosterFallbackUri } from '../utils/posterFallback';
import { psboxApi } from '../services/psboxApi';
import { t, type LangCode } from '../i18n/translations';
import type { AchievementItem, AppSettings, CatalogProduct, GlyphStyle, PerGameProfile } from '../types';
import { AchievementsModal } from './AchievementsModal';
import { GamerscoreBadge } from './BrandMark';
import { PerGameSettingsModal } from './PerGameSettingsModal';
import { ButtonGlyph } from './PlayStationGlyphs';

interface GameDetailsModalProps {
  lang: LangCode;
  product: CatalogProduct;
  settings: AppSettings;
  wishlisted: boolean;
  favorited: boolean;
  hidden: boolean;
  glyphStyle?: GlyphStyle;
  playtimeSec?: number;
  onToggleWishlist: () => void;
  onToggleFavorite: () => void;
  onToggleHidden: () => void;
  onSaveGameProfile: (profile: PerGameProfile | null) => void;
  onPlay: () => void;
  onClose: () => void;
}

function ratingBadgeStyle(age: string): { bg: string; fg: string } {
  if (age === 'Livre' || age === 'E' || age === '3+' || age === '0') return { bg: '#00a03c', fg: '#ffffff' };
  if (age === '10+' || age === 'E10+' || age === '7+') return { bg: '#0078dc', fg: '#ffffff' };
  if (age === '12+') return { bg: '#e6b400', fg: '#141414' };
  if (age === '14+' || age === 'T') return { bg: '#eb6400', fg: '#ffffff' };
  if (age === '16+' || age === 'M') return { bg: '#d21e1e', fg: '#ffffff' };
  if (age === '18+' || age === 'AO') return { bg: '#1e1e1e', fg: '#ffffff' };
  return { bg: '#646464', fg: '#ffffff' };
}

function planName(plan: 0 | 1 | 2 | 3): string | null {
  if (plan === 1) return 'Game Pass Essential';
  if (plan === 2) return 'Game Pass Premium';
  if (plan === 3) return 'Game Pass Ultimate';
  return null;
}

export const GameDetailsModal: React.FC<GameDetailsModalProps> = ({
  lang,
  product,
  settings,
  wishlisted,
  favorited,
  hidden,
  glyphStyle = 'playstation',
  playtimeSec = 0,
  onToggleWishlist,
  onToggleFavorite,
  onToggleHidden,
  onSaveGameProfile,
  onPlay,
  onClose,
}) => {
  const storeUrl = `https://www.xbox.com/games/store/p/${product.productId}`;
  const [storeQr, setStoreQr] = useState('');
  const [achOpen, setAchOpen] = useState(false);
  const [achItems, setAchItems] = useState<AchievementItem[]>([]);
  const [gameSettingsOpen, setGameSettingsOpen] = useState(false);
  const showBuyQr = !product.playable && product.purchasable && !product.isFreeToPlay;
  const achUnlocked = achItems.filter((a) => a.unlocked).length;
  const achGs = achItems.filter((a) => a.unlocked).reduce((s, a) => s + a.gamerscore, 0);
  const achTotalGs = achItems.reduce((s, a) => s + a.gamerscore, 0);
  const hasCustomProfile = Boolean(settings.perGameSettings[product.productId]);

  useEffect(() => {
    let active = true;
    psboxApi
      .getAchievements(product.xboxTitleId)
      .then((res) => {
        if (active) setAchItems(res);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [product.xboxTitleId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!showBuyQr) return;
    QRCode.toDataURL(storeUrl, {
      margin: 2,
      width: 240,
      color: { dark: '#0e0e0e', light: '#ffffff' },
    })
      .then(setStoreQr)
      .catch(() => {});
  }, [showBuyQr, storeUrl]);

  const rating = product.ratingAge ? ratingBadgeStyle(product.ratingAge) : null;
  const plan = planName(product.plan);
  const metaCats = [
    product.platform,
    ...product.categories,
    product.mouseKeyboard ? 'Mouse & Keyboard supported' : null,
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 bg-[#0e0e0e] flex flex-col overflow-y-auto">
      {/* Full-bleed PSBox Hero Backdrop */}
      <div className="fixed inset-0 pointer-events-none">
        <img
          src={product.heroUrl || product.posterUrl || product.tileUrl}
          alt={product.title}
          onError={(e) => {
            const el = e.currentTarget;
            if (!el.dataset.fallback) {
              el.dataset.fallback = '1';
              el.src = makePosterFallbackUri(product.title, product.publisher);
            }
          }}
          className="w-full h-full object-cover opacity-85"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(14,14,14,0.96) 0%, rgba(14,14,14,0.78) 48%, rgba(14,14,14,0.18) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(14,14,14,0) 22%, rgba(14,14,14,0.94) 85%, #0e0e0e 100%)',
          }}
        />
      </div>

      {/* Top Close Row */}
      <div className="relative z-10 max-w-[1600px] w-full mx-auto px-5 sm:px-14 pt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#242424]/90 hover:bg-white hover:text-[#0e0e0e] text-sm font-semibold text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
          Back
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setGameSettingsOpen(true)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold cursor-pointer border transition-colors ${
              hasCustomProfile
                ? 'bg-[#107c10] border-emerald-400 text-white'
                : 'bg-[#242424]/90 border-white/10 text-[#bebebe] hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            {hasCustomProfile ? 'Game Settings (Custom)' : 'Game Settings'}
          </button>
          <button
            type="button"
            onClick={onToggleFavorite}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold cursor-pointer border transition-colors ${
              favorited
                ? 'bg-rose-500/20 border-rose-400/60 text-rose-200'
                : 'bg-[#242424]/90 border-white/10 text-[#bebebe] hover:text-white'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${favorited ? 'fill-rose-400 text-rose-400' : ''}`} />
            {favorited ? 'Favourited' : 'Favourite'}
          </button>
          <button
            type="button"
            onClick={onToggleWishlist}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold cursor-pointer border transition-colors ${
              wishlisted
                ? 'bg-[#0a1423] border-[#288cff]/70 text-sky-300'
                : 'bg-[#242424]/90 border-white/10 text-[#bebebe] hover:text-white'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${wishlisted ? 'fill-sky-400 text-sky-400' : ''}`} />
            {wishlisted ? 'Wishlisted' : 'Wishlist'}
          </button>
          <button
            type="button"
            onClick={onToggleHidden}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#242424]/90 border border-white/10 text-xs font-semibold text-[#bebebe] hover:text-white cursor-pointer"
          >
            {hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {hidden ? 'Unhide' : 'Hide'}
          </button>
        </div>
      </div>

      {/* Main Details Content (Left column text + Right cover/QR) */}
      <div className="relative z-10 flex-1 max-w-[1600px] w-full mx-auto px-5 sm:px-14 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-8 space-y-5">
          <h1 className="text-3xl sm:text-6xl font-bold text-white tracking-tight leading-tight">
            {product.title}
          </h1>

          <p className="text-base sm:text-xl font-semibold text-[#bebebe]">
            {product.publisher ? `by ${product.publisher}` : ''}
            {plan && product.playable ? `${product.publisher ? '  •  ' : ''}Included with ${plan}` : ''}
          </p>

          {/* Rating Badge + Descriptors */}
          {rating && (
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="px-2.5 py-1 rounded-[6px] text-sm font-bold leading-none border border-white/20"
                style={{ backgroundColor: rating.bg, color: rating.fg }}
              >
                {product.ratingAge}
              </span>
              {product.ratingSystem && (
                <span className="text-sm font-semibold text-[#8c8c8c]">{product.ratingSystem}</span>
              )}
            </div>
          )}

          {/* Platform • Categories • MKB */}
          {metaCats.length > 0 && (
            <div className="text-sm sm:text-base text-[#8c8c8c] font-medium">
              {metaCats.join('  •  ')}
            </div>
          )}

          {/* Description */}
          {product.description && (
            <p className="text-sm sm:text-lg text-[#bebebe] leading-relaxed max-w-3xl">
              {product.description}
            </p>
          )}

          {/* Price line when unplayable store item */}
          {showBuyQr && product.price && (
            <div className="space-y-2 pt-2">
              <div className="text-3xl sm:text-4xl font-bold text-white">{product.price.formatted}</div>
              <div className="flex items-center gap-2 text-base font-semibold text-white">
                <ShoppingBag className="w-4 h-4 text-[#107c10]" />
                Buy on Xbox Store to play via Cloud
              </div>
            </div>
          )}

          {/* Play / Buy / Locked Actions */}
          <div className="flex flex-wrap items-center gap-4 pt-3">
            {product.playable || product.isFreeToPlay ? (
              <button
                type="button"
                onClick={onPlay}
                className="inline-flex items-center justify-center gap-3 px-10 py-4 rounded-full bg-[#107c10] hover:bg-[#16a34a] text-white font-semibold text-lg shadow-[0_0_0_4px_#0e0e0e,0_0_0_7px_#ffffff] cursor-pointer transition-all"
              >
                <Play className="w-5 h-5 fill-white" />
                {t(lang, 'play')}
              </button>
            ) : product.purchasable ? (
              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-[#107c10] hover:bg-[#16a34a] text-white font-semibold text-base shadow-[0_0_0_4px_#0e0e0e,0_0_0_7px_#ffffff] transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                Buy on Xbox.com
              </a>
            ) : (
              <div className="inline-flex items-center gap-3 px-7 py-4 rounded-full bg-white/15 text-[#bebebe] font-semibold">
                <Lock className="w-5 h-5" />
                {plan ? `Included with ${plan}` : 'Not Playable on Cloud'}
              </div>
            )}

            {/* Achievements Button matching PSBox drawDetails */}
            <button
              type="button"
              onClick={() => setAchOpen(true)}
              className="inline-flex items-center gap-2.5 px-6 py-4 rounded-full bg-white/15 hover:bg-white/25 text-white font-semibold text-sm sm:text-base cursor-pointer transition-colors"
            >
              <GamerscoreBadge size={16} />
              <span>
                {achItems.length > 0
                  ? `${achUnlocked}/${achItems.length} (${achGs}/${achTotalGs} G)`
                  : 'Achievements'}
              </span>
            </button>

            <a
              href={storeUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-6 py-4 rounded-full bg-[#242424] hover:bg-[#333333] text-white font-semibold text-sm transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Xbox Store
            </a>

            {playtimeSec > 0 && (
              <span className="px-4 py-2 rounded-full bg-black/60 text-sm font-semibold text-white">
                {Math.floor(playtimeSec / 60)}m played
              </span>
            )}
          </div>
        </div>

        {/* Right Cover or Store QR */}
        <div className="lg:col-span-4 flex flex-col items-center lg:items-end justify-center">
          {showBuyQr && storeQr ? (
            <div className="bg-white rounded-3xl p-5 shadow-2xl text-center max-w-[260px]">
              <img src={storeQr} alt="Xbox Store QR" className="w-full h-auto rounded-xl" />
              <p className="text-xs font-semibold text-[#0e0e0e] mt-3">Scan to buy on Xbox Store</p>
            </div>
          ) : (
            <img
              src={product.tileUrl || product.posterUrl}
              alt={product.title}
              onError={(e) => {
                const el = e.currentTarget;
                if (!el.dataset.fallback) {
                  el.dataset.fallback = '1';
                  el.src = makePosterFallbackUri(product.title, product.publisher);
                }
              }}
              className="hidden lg:block w-80 h-80 rounded-2xl object-cover shadow-2xl border border-white/15"
            />
          )}
        </div>
      </div>

      {/* Bottom PlayStation Hints Bar */}
      <div className="hidden sm:flex relative z-10 max-w-[1600px] w-full mx-auto px-14 pb-6 items-center justify-end gap-6 text-sm font-semibold text-[#bebebe]">
        {product.playable || product.isFreeToPlay ? (
          <button type="button" onClick={onPlay} className="inline-flex items-center gap-2 hover:text-white cursor-pointer">
            <ButtonGlyph icon="cross" style={glyphStyle} />
            <span>Play</span>
          </button>
        ) : null}
        <button type="button" onClick={() => setGameSettingsOpen(true)} className="inline-flex items-center gap-2 hover:text-white cursor-pointer">
          <ButtonGlyph icon="options" style={glyphStyle} />
          <span>Game settings</span>
        </button>
        <button type="button" onClick={onToggleFavorite} className="inline-flex items-center gap-2 hover:text-white cursor-pointer">
          <ButtonGlyph icon="triangle" style={glyphStyle} />
          <span>{favorited ? 'Remove favourite' : 'Add to favourites'}</span>
        </button>
        <button type="button" onClick={onToggleHidden} className="inline-flex items-center gap-2 hover:text-white cursor-pointer">
          <ButtonGlyph icon="square" style={glyphStyle} />
          <span>{hidden ? 'Unhide' : 'Hide'}</span>
        </button>
        <button type="button" onClick={onToggleWishlist} className="inline-flex items-center gap-2 hover:text-white cursor-pointer">
          <ButtonGlyph icon="r3" style={glyphStyle} />
          <span>{wishlisted ? 'Remove wishlist' : 'Add to wishlist'}</span>
        </button>
        <button type="button" onClick={onClose} className="inline-flex items-center gap-2 hover:text-white cursor-pointer">
          <ButtonGlyph icon="circle" style={glyphStyle} />
          <span>Back</span>
        </button>
      </div>

      {achOpen && (
        <AchievementsModal
          product={product}
          glyphStyle={glyphStyle}
          onClose={() => setAchOpen(false)}
        />
      )}

      {gameSettingsOpen && (
        <PerGameSettingsModal
          product={product}
          settings={settings}
          glyphStyle={glyphStyle}
          onSaveProfile={onSaveGameProfile}
          onClose={() => setGameSettingsOpen(false)}
        />
      )}
    </div>
  );
};
