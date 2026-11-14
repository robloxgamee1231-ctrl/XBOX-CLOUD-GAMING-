import React from 'react';
import type { GlyphStyle } from '../types';

export type HintIconType =
  | 'cross'
  | 'circle'
  | 'square'
  | 'triangle'
  | 'options'
  | 'touchpad'
  | 'l1r1'
  | 'l3'
  | 'r3';

export const ButtonGlyph: React.FC<{
  icon: HintIconType;
  style?: GlyphStyle;
  size?: number;
}> = ({ icon, style = 'playstation', size = 24 }) => {
  if (style === 'xbox') {
    const xboxMap: Record<HintIconType, { text: string; color: string }> = {
      cross: { text: 'A', color: '#22c55e' },
      circle: { text: 'B', color: '#ef4444' },
      square: { text: 'X', color: '#38bdf8' },
      triangle: { text: 'Y', color: '#eab308' },
      options: { text: '≡', color: '#bebebe' },
      touchpad: { text: '⧉', color: '#bebebe' },
      l1r1: { text: 'LB/RB', color: '#bebebe' },
      l3: { text: 'LS', color: '#bebebe' },
      r3: { text: 'RS', color: '#bebebe' },
    };
    const item = xboxMap[icon];
    if (icon === 'l1r1' || icon === 'l3' || icon === 'r3') {
      return (
        <span className="px-2 py-0.5 rounded-md bg-white/15 text-[11px] font-bold text-[#bebebe]">
          {item.text}
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center justify-center rounded-full border-2 font-bold text-[11px] leading-none"
        style={{
          width: size,
          height: size,
          borderColor: item.color,
          color: item.color,
          backgroundColor: 'rgba(255,255,255,0.06)',
        }}
      >
        {item.text}
      </span>
    );
  }

  if (icon === 'l1r1' || icon === 'l3' || icon === 'r3') {
    const label = icon === 'l1r1' ? 'L1 | R1' : icon.toUpperCase();
    return (
      <span className="px-2 py-0.5 rounded-md bg-white/15 text-[11px] font-bold text-[#bebebe] tracking-wide">
        {label}
      </span>
    );
  }

  if (icon === 'touchpad') {
    return (
      <span className="inline-block w-7 h-4 rounded-[5px] bg-white/15 border-2 border-[#bebebe]" />
    );
  }

  if (icon === 'options') {
    return (
      <span className="inline-flex flex-col items-center justify-center gap-[3px] w-7 h-5 rounded-full bg-white/15">
        <span className="w-3.5 h-[1.5px] bg-[#bebebe]" />
        <span className="w-3.5 h-[1.5px] bg-[#bebebe]" />
        <span className="w-3.5 h-[1.5px] bg-[#bebebe]" />
      </span>
    );
  }

  // Exact PlayStation face button colors from PSBox pad_glyphs.cpp
  const bg = 'rgba(255, 255, 255, 0.14)';
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" className="shrink-0">
      <circle cx="14" cy="14" r="13" fill={bg} />
      {icon === 'cross' && (
        <g stroke="#64b5f6" strokeWidth="2.6" strokeLinecap="round">
          <line x1="9" y1="9" x2="19" y2="19" />
          <line x1="19" y1="9" x2="9" y2="19" />
        </g>
      )}
      {icon === 'circle' && (
        <circle cx="14" cy="14" r="5.5" fill="none" stroke="#ff6b6b" strokeWidth="2.5" />
      )}
      {icon === 'square' && (
        <rect x="8.8" y="8.8" width="10.4" height="10.4" rx="1" fill="none" stroke="#e879f9" strokeWidth="2.4" />
      )}
      {icon === 'triangle' && (
        <polygon points="14,7.8 20,18.8 8,18.8" fill="none" stroke="#4ade80" strokeWidth="2.4" strokeLinejoin="round" />
      )}
    </svg>
  );
};

export const XboxChassisArtwork: React.FC<{ consoleType: string; isOn: boolean }> = ({
  consoleType,
  isOn,
}) => {
  const isSeriesX = consoleType === 'XboxSeriesX';
  if (isSeriesX) {
    return (
      <div className="w-20 h-32 rounded-xl bg-[#141414] border-2 border-[#464646] relative flex flex-col items-center pt-3 shadow-inner shrink-0">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center ${
            isOn ? 'bg-[#107c10] shadow-[0_0_14px_rgba(16,124,16,0.9)]' : 'bg-[#5a5a5a]'
          }`}
        >
          <span className="text-[10px] font-black text-white">X</span>
        </div>
        <div className="mt-auto mb-3 w-1 h-8 rounded-full bg-white/10" />
      </div>
    );
  }
  return (
    <div className="w-40 h-14 rounded-xl bg-[#141414] border-2 border-[#464646] relative flex items-center px-4 shadow-inner shrink-0">
      <div
        className={`w-4 h-4 rounded-full ${
          isOn ? 'bg-[#107c10] shadow-[0_0_12px_rgba(16,124,16,0.9)]' : 'bg-[#5a5a5a]'
        }`}
      />
      <div className="ml-auto w-14 h-2 rounded-full bg-white/10" />
    </div>
  );
};
