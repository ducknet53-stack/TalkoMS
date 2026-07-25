export const TALKO_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <rect width="1000" height="1000" rx="220" fill="#0066ff" />
  <path d="M 370 260 H 630 A 140 140 0 0 1 770 400 V 510 A 140 140 0 0 1 630 650 H 470 L 350 730 V 650 A 120 120 0 0 1 230 530 V 400 A 140 140 0 0 1 370 260 Z" fill="white" />
  <rect x="320" y="345" width="360" height="80" rx="20" fill="#0066ff" />
  <path d="M 425 425 L 390 585 L 490 535 L 540 425 Z" fill="#0066ff" />
  <rect x="545" y="432" width="100" height="46" rx="14" fill="#0066ff" />
</svg>`;
export const TALKO_LOGO_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(TALKO_LOGO_SVG)}`;

export const TALKO_AI_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="aiBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="100%" stop-color="#7C3AED" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  
  <rect width="100" height="100" fill="url(#aiBg)" />
  
  <!-- Sleek 4-pointed star / spark -->
  <path d="M 50 15 C 50 45 45 50 15 50 C 45 50 50 55 50 85 C 50 55 55 50 85 50 C 55 50 50 45 50 15 Z" fill="#FFFFFF" filter="url(#glow)"/>
  <path d="M 50 15 C 50 45 45 50 15 50 C 45 50 50 55 50 85 C 50 55 55 50 85 50 C 55 50 50 45 50 15 Z" fill="#FFFFFF"/>
  
  <path d="M 75 25 C 75 35 72 38 62 38 C 72 38 75 41 75 51 C 75 41 78 38 88 38 C 78 38 75 35 75 25 Z" fill="#FFFFFF" opacity="0.8"/>
  <path d="M 30 70 C 30 77 28 79 21 79 C 28 79 30 81 30 88 C 30 81 32 79 39 79 C 32 79 30 77 30 70 Z" fill="#FFFFFF" opacity="0.6"/>
</svg>`;
export const TALKO_AI_LOGO_DATA_URL = `data:image/svg+xml;base64,${btoa(TALKO_AI_SVG)}`;

export const TALKO_VERIFIED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <circle cx="500" cy="500" r="450" fill="#F59E0B" />
  <path d="M 300 500 L 450 650 L 700 350" stroke="#FFFFFF" stroke-width="120" stroke-linecap="round" stroke-linejoin="round" fill="none" />
</svg>`;
export const TALKO_VERIFIED_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(TALKO_VERIFIED_SVG)}`;
