import React from 'react';

export const BrandMark: React.FC<{ size?: number; className?: string }> = ({
  size = 44,
  className = '',
}) => (
  <img
    src="./assets/icon0.png"
    alt="PSBox Cloud Gaming"
    width={size}
    height={size}
    className={`rounded-xl shadow-lg shadow-emerald-950/50 object-cover ${className}`}
  />
);

export const GamerscoreBadge: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block shrink-0" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="#9ca3af" />
    <path
      d="M17.5 8.5A6.5 6.5 0 1 0 18.5 12h-5.8"
      fill="none"
      stroke="#0c0e10"
      strokeWidth="2.8"
      strokeLinecap="round"
    />
  </svg>
);
