export function makePosterFallbackUri(title: string, subtitle: string): string {
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const safeSub = subtitle.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f291e"/>
        <stop offset="100%" stop-color="#0b0e14"/>
      </linearGradient>
    </defs>
    <rect width="600" height="600" fill="url(#g)"/>
    <circle cx="480" cy="120" r="140" fill="#107c10" fill-opacity="0.22"/>
    <text x="40" y="450" fill="#ffffff" font-family="Inter,system-ui,sans-serif" font-weight="800" font-size="38">${safeTitle.slice(0, 26)}</text>
    <text x="40" y="496" fill="#94a3b8" font-family="Inter,system-ui,sans-serif" font-weight="600" font-size="20">${safeSub.slice(0, 32)}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
