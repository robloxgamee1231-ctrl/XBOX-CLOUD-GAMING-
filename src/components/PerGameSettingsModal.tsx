import React from 'react';
import { RotateCcw, Sliders, X } from 'lucide-react';
import type {
  AppSettings,
  CatalogProduct,
  DebandLevel,
  GlyphStyle,
  GyroMode,
  PerGameProfile,
  ResolutionMode,
  SharpnessLevel,
  TriggerProfile,
  UpscalerMode,
} from '../types';
import { ButtonGlyph } from './PlayStationGlyphs';

interface PerGameSettingsModalProps {
  product: CatalogProduct;
  settings: AppSettings;
  glyphStyle?: GlyphStyle;
  onSaveProfile: (profile: PerGameProfile | null) => void;
  onClose: () => void;
}

export const PerGameSettingsModal: React.FC<PerGameSettingsModalProps> = ({
  product,
  settings,
  glyphStyle = 'playstation',
  onSaveProfile,
  onClose,
}) => {
  const existing = settings.perGameSettings[product.productId];
  const baseProfile: PerGameProfile = existing ?? {
    upscaler: settings.upscaler,
    sharpness: settings.sharpness,
    deband: settings.deband,
    resolution: settings.resolution,
    deadzone: settings.deadzone,
    triggerStrength: settings.triggerStrength,
    triggerProfile: settings.triggerProfile,
    gyroMode: settings.gyroMode,
    circleConfirms: settings.circleConfirms,
  };

  const [enabled, setEnabled] = React.useState(Boolean(existing));
  const [draft, setDraft] = React.useState<PerGameProfile>(baseProfile);

  const update = (patch: Partial<PerGameProfile>) => {
    setEnabled(true);
    setDraft((p) => ({ ...p, ...patch }));
  };

  const handleSave = () => {
    onSaveProfile(enabled ? draft : null);
    onClose();
  };

  const handleReset = () => {
    setEnabled(false);
    onSaveProfile(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#242424] rounded-3xl border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 pt-6 pb-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-[#107c10]" />
            <div>
              <h2 className="text-xl font-bold text-white">Game settings</h2>
              <p className="text-xs text-[#8c8c8c]">{product.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-7 py-5 overflow-y-auto space-y-4 text-sm">
          {/* Profile Mode */}
          <div className="flex items-center justify-between bg-[#0e0e0e]/60 rounded-xl px-4 py-3">
            <div>
              <div className="font-semibold text-white">Profile</div>
              <div className="text-xs text-[#8c8c8c]">Override global app settings for this title</div>
            </div>
            <div className="flex items-center gap-1.5 bg-[#242424] p-1 rounded-full">
              <button
                type="button"
                onClick={() => setEnabled(false)}
                className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                  !enabled ? 'bg-white text-[#0e0e0e]' : 'text-[#bebebe]'
                }`}
              >
                Default
              </button>
              <button
                type="button"
                onClick={() => setEnabled(true)}
                className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                  enabled ? 'bg-[#107c10] text-white' : 'text-[#bebebe]'
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block bg-[#0e0e0e]/50 rounded-xl p-3.5 space-y-1.5">
              <span className="text-xs font-semibold text-[#8c8c8c] uppercase">Upscaling</span>
              <select
                value={draft.upscaler}
                onChange={(e) => update({ upscaler: e.target.value as UpscalerMode })}
                className="w-full bg-[#242424] border border-white/15 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="fsr">FSR</option>
                <option value="fsr_clean">FSR + clean-up</option>
                <option value="ai">AI (Anime4K)</option>
                <option value="ai_clean">AI + clean-up</option>
              </select>
            </label>

            <label className="block bg-[#0e0e0e]/50 rounded-xl p-3.5 space-y-1.5">
              <span className="text-xs font-semibold text-[#8c8c8c] uppercase">Sharpness</span>
              <select
                value={draft.sharpness}
                onChange={(e) => update({ sharpness: e.target.value as SharpnessLevel })}
                className="w-full bg-[#242424] border border-white/15 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="off">Off</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            <label className="block bg-[#0e0e0e]/50 rounded-xl p-3.5 space-y-1.5">
              <span className="text-xs font-semibold text-[#8c8c8c] uppercase">Block smoothing</span>
              <select
                value={draft.deband}
                onChange={(e) => update({ deband: e.target.value as DebandLevel })}
                className="w-full bg-[#242424] border border-white/15 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="auto">Auto</option>
                <option value="off">Off</option>
                <option value="low">Low</option>
                <option value="high">High</option>
              </select>
            </label>

            <label className="block bg-[#0e0e0e]/50 rounded-xl p-3.5 space-y-1.5">
              <span className="text-xs font-semibold text-[#8c8c8c] uppercase">Stream resolution</span>
              <select
                value={draft.resolution}
                onChange={(e) => update({ resolution: e.target.value as ResolutionMode })}
                className="w-full bg-[#242424] border border-white/15 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="720p">720p (uses less data)</option>
                <option value="1080p">1080p (Full HD)</option>
                <option value="1080pHQ">1080p HQ (High Bitrate)</option>
                <option value="1440p">Best (1440p Auto)</option>
              </select>
            </label>

            <label className="block bg-[#0e0e0e]/50 rounded-xl p-3.5 space-y-1.5">
              <span className="text-xs font-semibold text-[#8c8c8c] uppercase">
                Stick dead zone ({Math.round(draft.deadzone * 100)}%)
              </span>
              <input
                type="range"
                min={0}
                max={0.3}
                step={0.01}
                value={draft.deadzone}
                onChange={(e) => update({ deadzone: Number(e.target.value) })}
                className="w-full accent-[#107c10]"
              />
            </label>

            <label className="block bg-[#0e0e0e]/50 rounded-xl p-3.5 space-y-1.5">
              <span className="text-xs font-semibold text-[#8c8c8c] uppercase">Trigger profile</span>
              <select
                value={draft.triggerProfile}
                onChange={(e) => update({ triggerProfile: e.target.value as TriggerProfile })}
                className="w-full bg-[#242424] border border-white/15 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="standard">Standard</option>
                <option value="shooter">Shooter (Hair Trigger)</option>
                <option value="racing">Racing (ABS)</option>
              </select>
            </label>

            <label className="block bg-[#0e0e0e]/50 rounded-xl p-3.5 space-y-1.5">
              <span className="text-xs font-semibold text-[#8c8c8c] uppercase">Gyro aiming</span>
              <select
                value={draft.gyroMode}
                onChange={(e) => update({ gyroMode: e.target.value as GyroMode })}
                className="w-full bg-[#242424] border border-white/15 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="off">Off</option>
                <option value="always">Always</option>
                <option value="aiming">While aiming (L2)</option>
                <option value="steering">Steering wheel (Left Stick)</option>
                <option value="steering_drive">Steering wheel (R2)</option>
              </select>
            </label>

            <label className="block bg-[#0e0e0e]/50 rounded-xl p-3.5 space-y-1.5">
              <span className="text-xs font-semibold text-[#8c8c8c] uppercase">Trigger vibration</span>
              <select
                value={draft.triggerStrength}
                onChange={(e) => update({ triggerStrength: Number(e.target.value) })}
                className="w-full bg-[#242424] border border-white/15 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value={0}>Off</option>
                <option value={1}>Light</option>
                <option value={2}>Medium</option>
                <option value={3}>Strong</option>
                <option value={4}>Max</option>
              </select>
            </label>
          </div>
        </div>

        <div className="px-7 py-4 bg-[#0e0e0e] flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={handleReset} className="psbox-btn text-xs">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to default
          </button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="psbox-btn text-xs">
              <ButtonGlyph icon="circle" style={glyphStyle} size={18} />
              Cancel
            </button>
            <button type="button" onClick={handleSave} className="psbox-btn psbox-btn-primary text-xs">
              <ButtonGlyph icon="cross" style={glyphStyle} size={18} />
              Save Game Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
