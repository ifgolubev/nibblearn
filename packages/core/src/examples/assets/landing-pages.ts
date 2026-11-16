/**
 * Original mocks of a fictional Northwind Outdoor landing page before and after a
 * conversion-rate-optimisation sprint (1200×800 each), used by the image-compare demo.
 * The page goal is sign-ups for a free spring trail guide.
 *
 * Annotation reference (percent of width / height):
 *   before  headline in carousel   x 41.0  y 22.8
 *   before  three competing CTAs   x 41.5  y 32.3
 *   before  nine-field form        x 83.0  y 50.0
 *   after   three-field form + CTA x 42.5  y 66.0
 *   after   trust bar              x 72.0  y 93.0
 */

const FONT = "Inter, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
const INK = "#1e3a34";
const MUTED = "#5b6762";
const LINE = "#e3ddd1";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function text(
  x: number,
  y: number,
  s: string,
  o: { size?: number; weight?: number; fill?: string; anchor?: string; spacing?: number } = {},
): string {
  const { size = 14, weight = 400, fill = INK, anchor = "start", spacing = 0 } = o;
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${spacing ? ` letter-spacing="${spacing}"` : ""}>${esc(s)}</text>`;
}

function field(x: number, y: number, w: number, label: string, h = 30, select = false): string {
  return `${text(x, y, label, { size: 11, weight: 500, fill: MUTED })}
    <rect x="${x}" y="${y + 6}" width="${w}" height="${h}" rx="4" fill="#ffffff" stroke="#cfc9bd"/>${
      select
        ? `<path d="M${x + w - 18} ${y + 6 + h / 2 - 3} l5 5 l5 -5" fill="none" stroke="${MUTED}" stroke-width="1.6"/>`
        : ""
    }`;
}

function logo(x: number, y: number, size = 32): string {
  const s = size / 52;
  return `<g transform="translate(${x} ${y}) scale(${s})">
      <rect width="52" height="52" rx="14" fill="${INK}"/>
      <path d="M10 40 L24 18 L32 30 L38 22 L44 40 Z" fill="#f5f0e6"/>
    </g>${text(x + size + 10, y + size * 0.68, "NORTHWIND", { size: size * 0.56, weight: 800, spacing: 1.5 })}`;
}

function star(cx: number, cy: number, r: number, fill: string): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="${fill}"/>`;
}

function backpack(x: number, y: number, s: number): string {
  return `<g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-16" y="140" width="30" height="104" rx="12" fill="#1d3f55"/>
      <rect x="150" y="140" width="30" height="104" rx="12" fill="#1d3f55"/>
      <path d="M58 4 C 58 -28 106 -28 106 4" fill="none" stroke="#1d3f55" stroke-width="10" stroke-linecap="round"/>
      <rect x="0" y="0" width="164" height="270" rx="56" fill="#2f6280"/>
      <path d="M0 70 C 0 20 30 0 82 0 C 134 0 164 20 164 70 L164 80 C 130 92 34 92 0 80 Z" fill="#1d3f55"/>
      <rect x="28" y="106" width="108" height="14" rx="7" fill="#f2a93b"/>
      <rect x="24" y="144" width="116" height="104" rx="28" fill="#2c5b78"/>
      <path d="M40 170 H124" stroke="#16334a" stroke-width="3" stroke-linecap="round"/>
      <circle cx="124" cy="170" r="5" fill="#f2a93b"/>
    </g>`;
}

function mountains(x: number, y: number, w: number, h: number, id: string): string {
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>
    <g clip-path="url(#${id})">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#c8e2da"/>
      <circle cx="${x + w * 0.78}" cy="${y + h * 0.26}" r="${h * 0.12}" fill="#f7dfa6"/>
      <path d="M${x} ${y + h * 0.7} L${x + w * 0.18} ${y + h * 0.42} L${x + w * 0.32} ${y + h * 0.58} L${x + w * 0.52} ${y + h * 0.3} L${x + w * 0.7} ${y + h * 0.55} L${x + w * 0.86} ${y + h * 0.4} L${x + w} ${y + h * 0.6} V${y + h} H${x} Z" fill="#a9cdb8"/>
      <path d="M${x} ${y + h * 0.86} L${x + w * 0.22} ${y + h * 0.68} L${x + w * 0.44} ${y + h * 0.8} L${x + w * 0.66} ${y + h * 0.66} L${x + w} ${y + h * 0.84} V${y + h} H${x} Z" fill="#5a8f78"/>
    </g>`;
}

/* ------------------------------------------------------------------ before */

const beforeFields: [string, boolean][] = [
  ["First name *", false],
  ["Last name *", false],
  ["Email *", false],
  ["Phone", false],
  ["Street address *", false],
  ["City *", false],
  ["ZIP code *", false],
  ["Date of birth *", false],
  ["How did you hear about us? *", true],
];

const navLinks = [
  "Men",
  "Women",
  "Kids",
  "Camping",
  "Climbing",
  "Running",
  "Sale",
  "Brands",
  "Blog",
];

const tiles = [
  {
    title: "Clearance: up to 60% off",
    lines: ["Last season's jackets, boots", "and sleeping bags while", "sizes last."],
    tint: "#f3d9c8",
  },
  {
    title: "Blog: 10 spring trail tips",
    lines: ["From layering to snacks, our", "staff share what they pack", "for the first hikes."],
    tint: "#d8e6dd",
  },
  {
    title: "Gift cards for adventurers",
    lines: ["Send a digital gift card", "in any amount, delivered", "instantly by email."],
    tint: "#e4dff0",
  },
];

export const landingBeforeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" font-family="${FONT}" role="img" aria-label="Cluttered Northwind Outdoor landing page before the optimisation sprint">
  <rect width="1200" height="800" fill="#ffffff"/>

  <!-- Promo strip -->
  <rect width="1200" height="30" fill="${INK}"/>
  ${text(600, 20, "FREE SHIPPING OVER $75  ·  NEW ARRIVALS EVERY WEEK  ·  JOIN NORTHWIND REWARDS  ·  GET THE APP", { size: 11, weight: 600, fill: "#f5f0e6", anchor: "middle", spacing: 1 })}

  <!-- Navigation -->
  <rect y="30" width="1200" height="64" fill="#ffffff"/>
  <line x1="0" y1="94" x2="1200" y2="94" stroke="${LINE}"/>
  ${logo(32, 46)}
  ${navLinks.map((l, i) => text(228 + i * 66, 67, l, { size: 13, weight: 500, fill: "#3a4642" })).join("")}
  <rect x="842" y="46" width="214" height="32" rx="6" fill="#ffffff" stroke="#cfc9bd"/>
  ${text(856, 66, "Search 4,000+ products", { size: 12, fill: "#8a918d" })}
  <circle cx="1090" cy="62" r="12" fill="none" stroke="#3a4642" stroke-width="1.6"/>
  <circle cx="1126" cy="62" r="12" fill="none" stroke="#3a4642" stroke-width="1.6"/>
  <circle cx="1162" cy="62" r="12" fill="none" stroke="#3a4642" stroke-width="1.6"/>
  <circle cx="1170" cy="52" r="7" fill="#c4542a"/>
  ${text(1170, 56, "3", { size: 9, weight: 700, fill: "#ffffff", anchor: "middle" })}

  <!-- Carousel -->
  ${mountains(32, 112, 748, 360, "nwlb-car")}
  ${backpack(610, 286, 0.6)}
  <rect x="64" y="148" width="420" height="68" rx="4" fill="#ffffff" opacity="0.88"/>
  ${text(80, 176, "Spring is here! Explore the new collection,", { size: 17, weight: 500, fill: "#3a4642" })}
  ${text(80, 200, "and download our free spring trail guide.", { size: 17, weight: 500, fill: "#3a4642" })}
  <rect x="64" y="238" width="118" height="40" rx="4" fill="#c4542a"/>
  ${text(123, 263, "Shop now", { size: 14, weight: 600, fill: "#ffffff", anchor: "middle" })}
  <rect x="194" y="238" width="128" height="40" rx="4" fill="#2f6280"/>
  ${text(258, 263, "Learn more", { size: 14, weight: 600, fill: "#ffffff", anchor: "middle" })}
  <rect x="334" y="238" width="134" height="40" rx="4" fill="#3f7d5b"/>
  ${text(401, 263, "Find a store", { size: 14, weight: 600, fill: "#ffffff", anchor: "middle" })}
  <circle cx="58" cy="380" r="18" fill="#ffffff" opacity="0.85"/>
  <path d="M62 371 L54 380 L62 389" fill="none" stroke="#3a4642" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="754" cy="380" r="18" fill="#ffffff" opacity="0.85"/>
  <path d="M750 371 L758 380 L750 389" fill="none" stroke="#3a4642" stroke-width="2.4" stroke-linecap="round"/>
  ${[0, 1, 2, 3, 4].map((i) => `<circle cx="${370 + i * 18}" cy="452" r="5" fill="#ffffff" opacity="${i === 0 ? 1 : 0.55}"/>`).join("")}

  <!-- Promo tiles -->
  ${tiles
    .map((tile, i) => {
      const x = 32 + i * 256;
      return `<rect x="${x}" y="492" width="236" height="290" rx="6" fill="#ffffff" stroke="${LINE}"/>
    <rect x="${x}" y="492" width="236" height="118" rx="6" fill="${tile.tint}"/>
    ${text(x + 16, 640, tile.title, { size: 14, weight: 700 })}
    ${tile.lines.map((l, j) => text(x + 16, 664 + j * 18, l, { size: 12, fill: MUTED })).join("")}
    ${text(x + 16, 760, "Read more ›", { size: 12, weight: 600, fill: "#2f6280" })}`;
    })
    .join("")}

  <!-- Sidebar form -->
  <rect x="800" y="112" width="368" height="676" rx="6" fill="#f7f5f0" stroke="${LINE}"/>
  ${text(820, 142, "Get the trail guide", { size: 16, weight: 700 })}
  ${text(820, 162, "Fill in the form and we'll email it to you.", { size: 12, fill: MUTED })}
  ${beforeFields.map(([label, select], i) => field(820, 190 + i * 56, 328, label, 30, select)).join("")}
  <rect x="820" y="702" width="14" height="14" rx="2" fill="#ffffff" stroke="#cfc9bd"/>
  ${text(842, 713, "I agree to the terms, privacy policy and marketing emails.", { size: 10, fill: MUTED })}
  <rect x="820" y="732" width="96" height="34" rx="4" fill="#a3a9a5"/>
  ${text(868, 754, "Submit", { size: 13, weight: 600, fill: "#ffffff", anchor: "middle" })}
</svg>`;

/* ------------------------------------------------------------------- after */

export const landingAfterSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" font-family="${FONT}" role="img" aria-label="Focused Northwind Outdoor landing page after the optimisation sprint">
  <rect width="1200" height="800" fill="#ffffff"/>
  <rect y="72" width="1200" height="728" fill="#f5f0e6"/>

  <!-- Navigation -->
  ${logo(48, 20)}
  ${text(1152, 45, "Help", { size: 14, weight: 500, fill: "#3a4642", anchor: "end" })}

  <!-- Product hero -->
  <circle cx="900" cy="400" r="250" fill="#dcebe3"/>
  <g transform="rotate(-6 790 400)">
    <rect x="676" y="236" width="236" height="320" rx="12" fill="${INK}"/>
    ${mountains(696, 356, 196, 120, "nwlb-cover")}
    ${text(696, 290, "SPRING", { size: 30, weight: 800, fill: "#ffffff", spacing: 1 })}
    ${text(696, 324, "TRAIL GUIDE", { size: 30, weight: 800, fill: "#ffffff", spacing: 1 })}
    ${text(696, 512, "12 routes · packing lists", { size: 13, weight: 600, fill: "#f2c879" })}
    ${text(696, 534, "Northwind Outdoor · 2026", { size: 12, fill: "#c9d6d0" })}
  </g>
  ${backpack(940, 330, 0.95)}
  <ellipse cx="960" cy="604" rx="200" ry="12" fill="${INK}" opacity="0.12"/>

  <!-- Headline -->
  <rect x="64" y="112" width="226" height="30" rx="15" fill="#ffd166"/>
  ${text(177, 132, "FREE SPRING TRAIL GUIDE", { size: 12, weight: 800, anchor: "middle", spacing: 1.2 })}
  ${text(62, 210, "Your spring trail", { size: 58, weight: 800, spacing: -1.5 })}
  ${text(62, 276, "guide is ready.", { size: 58, weight: 800, spacing: -1.5 })}
  ${text(64, 320, "12 routes, packing checklists and 25% off your", { size: 19, fill: MUTED })}
  ${text(64, 346, "first order. Free, straight to your inbox.", { size: 19, fill: MUTED })}

  <!-- Three-field form -->
  <rect x="64" y="386" width="440" height="292" rx="18" fill="${INK}" opacity="0.06"/>
  <rect x="64" y="380" width="440" height="292" rx="18" fill="#ffffff"/>
  ${text(88, 410, "First name", { size: 12, weight: 600, fill: MUTED })}
  <rect x="88" y="418" width="392" height="40" rx="10" fill="#ffffff" stroke="#d8d2c4"/>
  ${text(104, 443, "Sam", { size: 14, fill: "#8a918d" })}
  ${text(88, 480, "Email", { size: 12, weight: 600, fill: MUTED })}
  <rect x="88" y="488" width="392" height="40" rx="10" fill="#ffffff" stroke="#d8d2c4"/>
  ${text(104, 513, "sam@example.com", { size: 14, fill: "#8a918d" })}
  ${text(88, 550, "Favourite activity", { size: 12, weight: 600, fill: MUTED })}
  <rect x="88" y="558" width="392" height="40" rx="10" fill="#ffffff" stroke="#d8d2c4"/>
  ${text(104, 583, "Hiking", { size: 14, fill: INK })}
  <path d="M456 575 l6 6 l6 -6" fill="none" stroke="${MUTED}" stroke-width="1.8"/>
  <rect x="88" y="612" width="392" height="48" rx="24" fill="#c4542a"/>
  ${text(284, 642, "Send me the guide →", { size: 17, weight: 700, fill: "#ffffff", anchor: "middle" })}
  ${text(64, 698, "No spam. Unsubscribe anytime.", { size: 12, fill: MUTED })}

  <!-- Trust bar -->
  <rect x="32" y="714" width="1136" height="72" rx="16" fill="${INK}"/>
  ${[0, 1, 2, 3, 4].map((i) => star(70 + i * 24, 750, 10, "#ffd166")).join("")}
  ${text(196, 756, "4.8/5 from 2,140 reviews", { size: 16, weight: 700, fill: "#ffffff" })}
  <line x1="470" y1="732" x2="470" y2="768" stroke="#ffffff" stroke-opacity="0.25"/>
  <circle cx="512" cy="750" r="12" fill="none" stroke="#f2c879" stroke-width="2"/>
  <path d="M506 750 l4 4 l8 -8" fill="none" stroke="#f2c879" stroke-width="2" stroke-linecap="round"/>
  ${text(536, 756, "48,000 hikers already get the guide", { size: 16, weight: 600, fill: "#ffffff" })}
  <line x1="880" y1="732" x2="880" y2="768" stroke="#ffffff" stroke-opacity="0.25"/>
  ${text(908, 756, "Featured in Trail Weekly", { size: 16, weight: 600, fill: "#ffffff" })}
</svg>`;

function toDataUri(svg: string): string {
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

/** Inline data URIs, safe to use as an <img src>. */
export const landingBeforeDataUri = toDataUri(landingBeforeSvg);
export const landingAfterDataUri = toDataUri(landingAfterSvg);
