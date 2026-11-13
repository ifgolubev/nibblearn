/**
 * Original mock of a fictional "Pulse Analytics" marketing dashboard (1200×760).
 * Kept as a string so the examples package needs no asset loader; the same
 * drawing lives in ./analytics-dashboard.svg for designers and docs.
 */
export const analyticsDashboardSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760" font-family="Inter, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" role="img" aria-label="Pulse Analytics dashboard mock">
  <!-- Page background -->
  <rect width="1200" height="760" fill="#f4f5f8"/>

  <!-- Sidebar -->
  <rect width="220" height="760" fill="#131a2b"/>
  <g transform="translate(24 24)">
    <rect width="32" height="32" rx="9" fill="#6366f1"/>
    <path d="M8 20 L13 12 L17 18 L21 9 L25 20" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="44" y="22" fill="#fff" font-size="16" font-weight="700">Pulse Analytics</text>
  </g>
  <g font-size="13" font-weight="500" fill="#9aa3b8">
    <rect x="12" y="92" width="196" height="38" rx="9" fill="#1f2840"/>
    <text x="48" y="116" fill="#ffffff" font-weight="600">Overview</text>
    <rect x="24" y="103" width="16" height="16" rx="4" fill="#6366f1"/>
    <text x="48" y="158">Campaigns</text>
    <rect x="24" y="145" width="16" height="16" rx="4" fill="#2a3450"/>
    <text x="48" y="200">Channels</text>
    <rect x="24" y="187" width="16" height="16" rx="4" fill="#2a3450"/>
    <text x="48" y="242">Audiences</text>
    <rect x="24" y="229" width="16" height="16" rx="4" fill="#2a3450"/>
    <text x="48" y="284">Attribution</text>
    <rect x="24" y="271" width="16" height="16" rx="4" fill="#2a3450"/>
    <text x="48" y="326">Reports</text>
    <rect x="24" y="313" width="16" height="16" rx="4" fill="#2a3450"/>
    <line x1="24" y1="356" x2="196" y2="356" stroke="#273047"/>
    <text x="48" y="392">Settings</text>
    <rect x="24" y="379" width="16" height="16" rx="4" fill="#2a3450"/>
  </g>
  <g transform="translate(24 680)">
    <circle cx="16" cy="16" r="16" fill="#3b4664"/>
    <text x="16" y="21" text-anchor="middle" fill="#fff" font-size="12" font-weight="600">MR</text>
    <text x="44" y="14" fill="#fff" font-size="13" font-weight="600">Maya Rinaldi</text>
    <text x="44" y="30" fill="#9aa3b8" font-size="11">Brightline Agency</text>
  </g>

  <!-- Header -->
  <rect x="220" width="980" height="72" fill="#ffffff"/>
  <line x1="220" y1="72" x2="1200" y2="72" stroke="#e5e7ee"/>
  <text x="250" y="44" font-size="20" font-weight="700" fill="#101522">Overview</text>
  <text x="358" y="44" font-size="13" fill="#6b7280">Client: Northwind Outdoor</text>
  <!-- Date picker -->
  <rect x="950" y="18" width="220" height="36" rx="9" fill="#ffffff" stroke="#d6dae3"/>
  <rect x="962" y="28" width="16" height="16" rx="3" fill="none" stroke="#6b7280" stroke-width="1.5"/>
  <line x1="962" y1="33" x2="978" y2="33" stroke="#6b7280" stroke-width="1.5"/>
  <text x="988" y="41" font-size="13" font-weight="500" fill="#101522">1 Mar – 31 Mar 2026</text>
  <path d="M1148 33 l5 5 l5 -5" fill="none" stroke="#6b7280" stroke-width="1.6" stroke-linecap="round"/>
  <!-- Compare toggle -->
  <rect x="846" y="18" width="92" height="36" rx="9" fill="#eef0f6"/>
  <text x="892" y="41" text-anchor="middle" font-size="13" font-weight="500" fill="#3f4656">Compare</text>

  <!-- KPI cards -->
  <g font-size="12">
    <!-- Spend -->
    <rect x="250" y="100" width="215" height="100" rx="14" fill="#ffffff" stroke="#e5e7ee"/>
    <text x="270" y="128" fill="#6b7280" font-weight="500">Spend</text>
    <text x="270" y="162" fill="#101522" font-size="26" font-weight="700">$48,200</text>
    <rect x="270" y="174" width="58" height="18" rx="9" fill="#fff1f2"/>
    <text x="299" y="187" text-anchor="middle" fill="#be123c" font-size="11" font-weight="600">+6.2%</text>
    <text x="336" y="187" fill="#9aa3b8" font-size="11">vs. Feb</text>
    <!-- ROAS -->
    <rect x="485" y="100" width="215" height="100" rx="14" fill="#ffffff" stroke="#e5e7ee"/>
    <text x="505" y="128" fill="#6b7280" font-weight="500">ROAS</text>
    <text x="505" y="162" fill="#101522" font-size="26" font-weight="700">3.4×</text>
    <rect x="505" y="174" width="58" height="18" rx="9" fill="#ecfdf3"/>
    <text x="534" y="187" text-anchor="middle" fill="#15803d" font-size="11" font-weight="600">+0.3×</text>
    <text x="571" y="187" fill="#9aa3b8" font-size="11">vs. Feb</text>
    <!-- CPA -->
    <rect x="720" y="100" width="215" height="100" rx="14" fill="#ffffff" stroke="#e5e7ee"/>
    <text x="740" y="128" fill="#6b7280" font-weight="500">CPA</text>
    <text x="740" y="162" fill="#101522" font-size="26" font-weight="700">$21.40</text>
    <rect x="740" y="174" width="58" height="18" rx="9" fill="#ecfdf3"/>
    <text x="769" y="187" text-anchor="middle" fill="#15803d" font-size="11" font-weight="600">−8.1%</text>
    <text x="806" y="187" fill="#9aa3b8" font-size="11">vs. Feb</text>
    <!-- CTR -->
    <rect x="955" y="100" width="215" height="100" rx="14" fill="#ffffff" stroke="#e5e7ee"/>
    <text x="975" y="128" fill="#6b7280" font-weight="500">CTR</text>
    <text x="975" y="162" fill="#101522" font-size="26" font-weight="700">2.8%</text>
    <rect x="975" y="174" width="58" height="18" rx="9" fill="#eef0f6"/>
    <text x="1004" y="187" text-anchor="middle" fill="#3f4656" font-size="11" font-weight="600">0.0%</text>
    <text x="1041" y="187" fill="#9aa3b8" font-size="11">vs. Feb</text>
  </g>

  <!-- Line chart -->
  <rect x="250" y="232" width="550" height="288" rx="14" fill="#ffffff" stroke="#e5e7ee"/>
  <text x="270" y="262" font-size="14" font-weight="600" fill="#101522">Daily spend vs. revenue</text>
  <g font-size="11" fill="#6b7280">
    <circle cx="640" cy="258" r="4" fill="#6366f1"/>
    <text x="650" y="262">Spend</text>
    <circle cx="710" cy="258" r="4" fill="#10b981"/>
    <text x="720" y="262">Revenue</text>
  </g>
  <g stroke="#eef0f4">
    <line x1="290" y1="300" x2="776" y2="300"/>
    <line x1="290" y1="345" x2="776" y2="345"/>
    <line x1="290" y1="390" x2="776" y2="390"/>
    <line x1="290" y1="435" x2="776" y2="435"/>
    <line x1="290" y1="480" x2="776" y2="480"/>
  </g>
  <g font-size="10" fill="#9aa3b8" text-anchor="end">
    <text x="284" y="304">$8k</text>
    <text x="284" y="349">$6k</text>
    <text x="284" y="394">$4k</text>
    <text x="284" y="439">$2k</text>
    <text x="284" y="484">$0</text>
  </g>
  <g font-size="10" fill="#9aa3b8" text-anchor="middle">
    <text x="300" y="502">1 Mar</text>
    <text x="420" y="502">8 Mar</text>
    <text x="540" y="502">15 Mar</text>
    <text x="660" y="502">22 Mar</text>
    <text x="770" y="502">31 Mar</text>
  </g>
  <path d="M300 438 L340 430 L380 436 L420 425 L460 428 L500 418 L540 420 L580 410 L620 414 L660 405 L700 408 L740 400 L770 402" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M300 410 L340 396 L380 404 L420 372 L460 380 L500 350 L540 358 L580 330 L620 338 L660 318 L700 326 L740 304 L770 312 L770 480 L300 480 Z" fill="#10b981" opacity="0.08"/>
  <path d="M300 410 L340 396 L380 404 L420 372 L460 380 L500 350 L540 358 L580 330 L620 338 L660 318 L700 326 L740 304 L770 312" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Annotation marker -->
  <line x1="580" y1="296" x2="580" y2="480" stroke="#d6dae3" stroke-dasharray="3 3"/>
  <rect x="546" y="280" width="68" height="18" rx="9" fill="#101522"/>
  <text x="580" y="293" text-anchor="middle" font-size="10" fill="#fff" font-weight="600">Bid change</text>

  <!-- Channel breakdown table -->
  <rect x="830" y="232" width="340" height="288" rx="14" fill="#ffffff" stroke="#e5e7ee"/>
  <text x="850" y="262" font-size="14" font-weight="600" fill="#101522">Channel breakdown</text>
  <g font-size="11" fill="#9aa3b8" font-weight="600">
    <text x="850" y="292">CHANNEL</text>
    <text x="1030" y="292" text-anchor="end">SPEND</text>
    <text x="1150" y="292" text-anchor="end">ROAS</text>
  </g>
  <line x1="850" y1="300" x2="1150" y2="300" stroke="#eef0f4"/>
  <g font-size="13" fill="#101522">
    <rect x="850" y="316" width="8" height="8" rx="2" fill="#6366f1"/>
    <text x="866" y="324">Paid search</text>
    <text x="1030" y="324" text-anchor="end" font-family="ui-monospace, SF Mono, Menlo, monospace" font-size="12">$19,800</text>
    <text x="1150" y="324" text-anchor="end" font-weight="600">4.1×</text>
    <line x1="850" y1="340" x2="1150" y2="340" stroke="#f1f3f7"/>
    <rect x="850" y="356" width="8" height="8" rx="2" fill="#10b981"/>
    <text x="866" y="364">Paid social</text>
    <text x="1030" y="364" text-anchor="end" font-family="ui-monospace, SF Mono, Menlo, monospace" font-size="12">$14,600</text>
    <text x="1150" y="364" text-anchor="end" font-weight="600">3.2×</text>
    <line x1="850" y1="380" x2="1150" y2="380" stroke="#f1f3f7"/>
    <rect x="850" y="396" width="8" height="8" rx="2" fill="#f59e0b"/>
    <text x="866" y="404">Display</text>
    <text x="1030" y="404" text-anchor="end" font-family="ui-monospace, SF Mono, Menlo, monospace" font-size="12">$8,100</text>
    <text x="1150" y="404" text-anchor="end" font-weight="600">1.9×</text>
    <line x1="850" y1="420" x2="1150" y2="420" stroke="#f1f3f7"/>
    <rect x="850" y="436" width="8" height="8" rx="2" fill="#ec4899"/>
    <text x="866" y="444">Email</text>
    <text x="1030" y="444" text-anchor="end" font-family="ui-monospace, SF Mono, Menlo, monospace" font-size="12">$3,400</text>
    <text x="1150" y="444" text-anchor="end" font-weight="600">6.8×</text>
    <line x1="850" y1="460" x2="1150" y2="460" stroke="#f1f3f7"/>
    <rect x="850" y="476" width="8" height="8" rx="2" fill="#94a3b8"/>
    <text x="866" y="484">Affiliate</text>
    <text x="1030" y="484" text-anchor="end" font-family="ui-monospace, SF Mono, Menlo, monospace" font-size="12">$2,300</text>
    <text x="1150" y="484" text-anchor="end" font-weight="600">2.4×</text>
  </g>

  <!-- Top campaigns -->
  <rect x="250" y="548" width="920" height="184" rx="14" fill="#ffffff" stroke="#e5e7ee"/>
  <text x="270" y="578" font-size="14" font-weight="600" fill="#101522">Top campaigns</text>
  <rect x="1046" y="562" width="104" height="26" rx="7" fill="#eef0f6"/>
  <text x="1098" y="579" text-anchor="middle" font-size="12" font-weight="500" fill="#3f4656">Export CSV</text>
  <g font-size="11" fill="#9aa3b8" font-weight="600">
    <text x="270" y="606">CAMPAIGN</text>
    <text x="620" y="606">STATUS</text>
    <text x="800" y="606" text-anchor="end">SPEND</text>
    <text x="950" y="606" text-anchor="end">CONV.</text>
    <text x="1100" y="606" text-anchor="end">CPA</text>
  </g>
  <line x1="270" y1="614" x2="1150" y2="614" stroke="#eef0f4"/>
  <g font-size="13" fill="#101522" font-family="ui-monospace, SF Mono, Menlo, monospace">
    <text x="270" y="640" font-family="Inter, sans-serif">Spring Launch — Search</text>
    <rect x="620" y="628" width="52" height="16" rx="8" fill="#ecfdf3"/>
    <text x="646" y="640" text-anchor="middle" font-size="10" font-weight="600" fill="#15803d" font-family="Inter, sans-serif">Active</text>
    <text x="800" y="640" text-anchor="end" font-size="12">$12,400</text>
    <text x="950" y="640" text-anchor="end" font-size="12">612</text>
    <text x="1100" y="640" text-anchor="end" font-size="12">$20.26</text>
    <line x1="270" y1="656" x2="1150" y2="656" stroke="#f1f3f7"/>
    <text x="270" y="680" font-family="Inter, sans-serif">Trail Collection — Social</text>
    <rect x="620" y="668" width="52" height="16" rx="8" fill="#ecfdf3"/>
    <text x="646" y="680" text-anchor="middle" font-size="10" font-weight="600" fill="#15803d" font-family="Inter, sans-serif">Active</text>
    <text x="800" y="680" text-anchor="end" font-size="12">$9,150</text>
    <text x="950" y="680" text-anchor="end" font-size="12">388</text>
    <text x="1100" y="680" text-anchor="end" font-size="12">$23.58</text>
    <line x1="270" y1="696" x2="1150" y2="696" stroke="#f1f3f7"/>
    <text x="270" y="720" font-family="Inter, sans-serif">Retargeting — Display</text>
    <rect x="620" y="708" width="52" height="16" rx="8" fill="#fff7ed"/>
    <text x="646" y="720" text-anchor="middle" font-size="10" font-weight="600" fill="#c2410c" font-family="Inter, sans-serif">Paused</text>
    <text x="800" y="720" text-anchor="end" font-size="12">$4,300</text>
    <text x="950" y="720" text-anchor="end" font-size="12">141</text>
    <text x="1100" y="720" text-anchor="end" font-size="12">$30.50</text>
  </g>
</svg>`;

/** Inline data URI, safe to use as an <img src>. */
export const analyticsDashboardDataUri =
  "data:image/svg+xml;utf8," + encodeURIComponent(analyticsDashboardSvg);
