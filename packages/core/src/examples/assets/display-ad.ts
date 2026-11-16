/**
 * Original mock of a fictional Northwind Outdoor spring-sale banner ad (1200×700), used by the
 * label-diagram demo. Kept as a string so the examples package needs no asset loader.
 *
 * Anchor reference (percent of width / height) used by the demo targets:
 *   logo        x 27.5  y 9.4    right end of the wordmark
 *   headline    x 34.2  y 42.9   end of "calling."
 *   offer       x 83.0  y 18.3   left edge of the round badge
 *   product     x 75.3  y 54.3   left edge of the backpack
 *   cta         x 29.0  y 70.9   right end of the button
 *   disclaimer  x 49.2  y 92.4   end of the legal lines
 */

const INK = "#1e3a34";
const MUTED = "#4a5a55";

function pine(x: number, base: number, h: number): string {
  const w = h * 0.42;
  return `<path d="M${x} ${base - h} L${x + w} ${base - h * 0.45} L${x + w * 0.55} ${base - h * 0.45} L${x + w * 1.15} ${base} L${x - w * 1.15} ${base} L${x - w * 0.55} ${base - h * 0.45} L${x - w} ${base - h * 0.45} Z" fill="#2f5d50"/>`;
}

export const displayAdSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700" font-family="Inter, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" role="img" aria-label="Northwind Outdoor spring sale banner ad mock">
  <defs>
    <linearGradient id="nwad-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#bfe0d8"/>
      <stop offset="0.8" stop-color="#ecf3ea"/>
    </linearGradient>
    <linearGradient id="nwad-pack" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3a6f8f"/>
      <stop offset="1" stop-color="#244c66"/>
    </linearGradient>
    <clipPath id="nwad-scene"><path d="M610 0 H1200 V700 H560 C 610 520 548 300 610 0 Z"/></clipPath>
  </defs>

  <!-- Background -->
  <rect width="1200" height="700" fill="#f5f0e6"/>

  <!-- Scene -->
  <g clip-path="url(#nwad-scene)">
    <rect x="540" width="660" height="700" fill="url(#nwad-sky)"/>
    <circle cx="760" cy="150" r="58" fill="#f7dfa6"/>
    <path d="M540 470 L660 350 L740 410 L860 270 L960 380 L1050 300 L1200 420 V700 H540 Z" fill="#a9cdb8"/>
    <path d="M860 270 L900 314 L878 312 L860 330 L842 306 L826 310 Z" fill="#f7f7f2"/>
    <path d="M540 560 L640 470 L720 520 L820 440 L930 530 L1030 470 L1200 560 V700 H540 Z" fill="#5a8f78"/>
    ${pine(600, 572, 70)}
    ${pine(644, 580, 48)}
    ${pine(1150, 578, 78)}
    ${pine(1106, 584, 52)}
    <path d="M540 588 C 700 568 980 570 1200 590 V700 H540 Z" fill="#e8dcc4"/>
  </g>

  <!-- Product shot: tent and backpack -->
  <ellipse cx="880" cy="604" rx="250" ry="14" fill="${INK}" opacity="0.14"/>
  <g>
    <path d="M738 440 L600 600" stroke="${INK}" stroke-opacity="0.35" stroke-width="1.5"/>
    <path d="M612 598 L738 440 L864 598 Z" fill="#d9773f"/>
    <path d="M738 440 L864 598 L892 598 L770 444 Z" fill="#b65c2b"/>
    <path d="M738 478 L700 598 L776 598 Z" fill="#6e3518"/>
    <path d="M738 478 L738 598" stroke="#d9773f" stroke-width="3"/>
    <line x1="738" y1="440" x2="738" y2="422" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  </g>
  <g>
    <rect x="884" y="470" width="30" height="104" rx="12" fill="#1d3f55"/>
    <rect x="1050" y="470" width="30" height="104" rx="12" fill="#1d3f55"/>
    <path d="M958 334 C 958 302 1006 302 1006 334" fill="none" stroke="#1d3f55" stroke-width="10" stroke-linecap="round"/>
    <rect x="900" y="330" width="164" height="270" rx="56" fill="url(#nwad-pack)"/>
    <path d="M900 400 C 900 350 930 330 982 330 C 1034 330 1064 350 1064 400 L1064 410 C 1030 422 934 422 900 410 Z" fill="#1d3f55"/>
    <path d="M968 382 L980 366 L988 376 L994 370 L1002 382 Z" fill="#f5f0e6"/>
    <rect x="928" y="436" width="108" height="14" rx="7" fill="#f2a93b"/>
    <rect x="924" y="474" width="116" height="104" rx="28" fill="#2c5b78"/>
    <path d="M940 500 H1024" stroke="#16334a" stroke-width="3" stroke-linecap="round"/>
    <circle cx="1024" cy="500" r="5" fill="#f2a93b"/>
  </g>

  <!-- Offer badge -->
  <g transform="rotate(-8 1072 128)">
    <circle cx="1072" cy="128" r="82" fill="#ffd166"/>
    <circle cx="1072" cy="128" r="70" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="3 7" stroke-linecap="round"/>
    <text x="1072" y="138" text-anchor="middle" font-size="50" font-weight="900" fill="${INK}" letter-spacing="-1">-25%</text>
    <text x="1072" y="166" text-anchor="middle" font-size="14" font-weight="800" fill="${INK}" letter-spacing="2">SPRING GEAR</text>
  </g>

  <!-- Ad info icon -->
  <g transform="translate(1134 10)">
    <rect width="56" height="22" rx="11" fill="#ffffff" opacity="0.92"/>
    <circle cx="12" cy="11" r="7" fill="none" stroke="#5b6b66" stroke-width="1.6"/>
    <rect x="11.2" y="9.6" width="1.6" height="5" fill="#5b6b66"/>
    <circle cx="12" cy="7.4" r="1" fill="#5b6b66"/>
    <text x="24" y="15.5" font-size="11" font-weight="600" fill="#5b6b66">Ad</text>
    <path d="M41 7 L49 15 M49 7 L41 15" stroke="#5b6b66" stroke-width="1.6" stroke-linecap="round"/>
  </g>

  <!-- Logo -->
  <g>
    <rect x="60" y="40" width="52" height="52" rx="14" fill="${INK}"/>
    <path d="M70 80 L84 58 L92 70 L98 62 L104 80 Z" fill="#f5f0e6"/>
    <text x="126" y="66" font-size="26" font-weight="800" fill="${INK}" letter-spacing="2">NORTHWIND</text>
    <text x="127" y="86" font-size="13" font-weight="600" fill="#4c6a60" letter-spacing="6">OUTDOOR</text>
  </g>

  <!-- Headline and subhead -->
  <text x="58" y="246" font-size="82" font-weight="800" fill="${INK}" letter-spacing="-2">Trails are</text>
  <text x="58" y="330" font-size="82" font-weight="800" fill="${INK}" letter-spacing="-2">calling.</text>
  <text x="60" y="390" font-size="24" fill="${MUTED}">Ultralight packs and two-person tents</text>
  <text x="60" y="422" font-size="24" fill="${MUTED}">for your first warm weekend outside.</text>

  <!-- Call to action -->
  <rect x="60" y="462" width="278" height="68" rx="34" fill="#c4542a"/>
  <text x="96" y="505" font-size="24" font-weight="700" fill="#ffffff">Shop the sale</text>
  <path d="M282 496 H308 M298 486 L308 496 L298 506" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Disclaimer -->
  <text x="60" y="638" font-size="14" fill="#6b756f">Offer valid 3–23 April 2026 on selected spring gear, while stocks last.</text>
  <text x="60" y="660" font-size="14" fill="#6b756f">Excludes clearance. Northwind Outdoor Ltd. Terms: northwind.example/spring</text>
</svg>`;

/** Inline data URI, safe to use as an <img src>. */
export const displayAdDataUri = "data:image/svg+xml;utf8," + encodeURIComponent(displayAdSvg);
