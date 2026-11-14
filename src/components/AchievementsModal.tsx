import React, { useEffect, useState } from 'react';
import { Check, Lock, RefreshCw, X } from 'lucide-react';
import { psboxApi } from '../services/psboxApi';
import type { AchievementItem, CatalogProduct, GlyphStyle } from '../types';
import { GamerscoreBadge } from './BrandMark';
import { ButtonGlyph } from './PlayStationGlyphs';

interface AchievementsModalProps {
  product: CatalogProduct;
  glyphStyle?: GlyphStyle;
  onClose: () => void;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  product,
  glyphStyle = 'playstation',
  onClose,
}) => {
  const [items, setItems] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    psboxApi
      .getAchievements(product.xboxTitleId)
      .then((res) => {
        if (active) setItems(res);
      })
      .catch(() => {
        if (active) setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [product.xboxTitleId]);

  const unlockedCount = items.filter((a) => a.unlocked).length;
  const totalCount = items.length;
  const unlockedGs = items.filter((a) => a.unlocked).reduce((s, a) => s + a.gamerscore, 0);
  const totalGs = items.reduce((s, a) => s + a.gamerscore, 0);
  const pct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#242424] rounded-3xl border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-7 pt-6 pb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Achievements</h2>
            <p className="text-xs text-[#8c8c8c] mt-0.5">{product.title}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm sm:text-base font-semibold text-white">
              <GamerscoreBadge size={16} />
              <span>
                {unlockedCount} / {totalCount} ({unlockedGs} / {totalGs} G)
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-7 pb-4">
          <div className="w-full h-2.5 rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full bg-[#107c10] rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Achievement List */}
        <div className="px-7 pb-6 overflow-y-auto space-y-2.5 flex-1">
          {loading ? (
            <div className="py-12 flex items-center justify-center gap-3 text-sm text-[#bebebe]">
              <RefreshCw className="w-5 h-5 text-white psbox-spinner" />
              Loading Xbox Live achievements...
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#8c8c8c]">
              No Xbox Live achievements available for this title yet.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-white/[0.06] px-4 py-3.5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      item.unlocked ? 'bg-[#107c10] text-white' : 'bg-white/10 text-[#8c8c8c]'
                    }`}
                  >
                    {item.unlocked ? <Check className="w-5 h-5 stroke-[2.5]" /> : <Lock className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`font-semibold text-base truncate ${
                        item.unlocked ? 'text-white' : item.isSecret ? 'text-[#8c8c8c]' : 'text-[#e5e5e5]'
                      }`}
                    >
                      {item.unlocked ? item.name : item.isSecret ? 'Secret achievement' : item.name}
                    </div>
                    <div className="text-xs sm:text-sm text-[#bebebe] truncate">
                      {item.unlocked
                        ? item.description
                        : item.isSecret
                          ? 'Locked'
                          : item.lockedDescription || item.description}
                    </div>
                  </div>
                </div>
                <div
                  className={`text-sm font-semibold shrink-0 ${
                    item.unlocked ? 'text-[#6ee178]' : 'text-[#8c8c8c]'
                  }`}
                >
                  {item.gamerscore} G
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-3 bg-[#0e0e0e] flex items-center justify-end gap-4 text-xs text-[#bebebe]">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 hover:text-white cursor-pointer">
            <ButtonGlyph icon="circle" style={glyphStyle} size={20} />
            <span>Back</span>
          </button>
        </div>
      </div>
    </div>
  );
};
