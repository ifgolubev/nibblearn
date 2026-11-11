/**
 * Original, fictional "Orbit CRM" mock screens used by the screenshot-walkthrough demo.
 * Everything is drawn as flat SVG (1200×760) so demos work offline and without real product UI.
 *
 * Layout reference (used by the walkthrough target rectangles):
 *   top bar      y 0–56, search box x 400–800 / y 10–46
 *   sidebar      x 0–220; nav items 40px tall starting at y 88 (Dashboard, Contacts, Deals, Tasks, Reports, Settings)
 *   content      x 244–1176
 *   table rows   56px tall starting at y 186
 *   detail tabs  y 170–210: Overview x 268–370, Activity x 386–488, Deals x 504–590
 */

const W = 1200;
const H = 760;
const FONT = "font-family='Inter, Segoe UI, Helvetica, Arial, sans-serif'";

const c = {
  bg: "#f7f8fb",
  surface: "#ffffff",
  sidebar: "#f1f3f7",
  border: "#e3e6ec",
  text: "#101828",
  muted: "#667085",
  subtle: "#98a2b3",
  accent: "#5b5bd6",
  accentSoft: "#eceefc",
  success: "#12b76a",
  successSoft: "#e8f8f0",
  warning: "#f79009",
  warningSoft: "#fff4e5",
};

type Nav = "dashboard" | "contacts" | "deals" | "tasks" | "reports" | "settings";

const NAV: { id: Nav; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "contacts", label: "Contacts" },
  { id: "deals", label: "Deals" },
  { id: "tasks", label: "Tasks" },
  { id: "reports", label: "Reports" },
  { id: "settings", label: "Settings" },
];

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function text(
  x: number,
  y: number,
  s: string,
  opts: { size?: number; weight?: number; fill?: string; anchor?: string } = {},
) {
  const { size = 14, weight = 400, fill = c.text, anchor = "start" } = opts;
  return `<text x='${x}' y='${y}' font-size='${size}' font-weight='${weight}' fill='${fill}' text-anchor='${anchor}' ${FONT}>${esc(s)}</text>`;
}

function avatar(x: number, y: number, r: number, initials: string, fill: string) {
  return `<circle cx='${x}' cy='${y}' r='${r}' fill='${fill}'/>${text(x, y + r * 0.38, initials, {
    size: r * 0.9,
    weight: 600,
    fill: "#ffffff",
    anchor: "middle",
  })}`;
}

function navIcon(x: number, y: number, id: Nav, color: string) {
  const s = `stroke='${color}' stroke-width='1.8' fill='none' stroke-linecap='round' stroke-linejoin='round'`;
  switch (id) {
    case "dashboard":
      return `<rect x='${x}' y='${y}' width='6' height='6' rx='1.2' ${s}/><rect x='${x + 9}' y='${y}' width='6' height='6' rx='1.2' ${s}/><rect x='${x}' y='${y + 9}' width='6' height='6' rx='1.2' ${s}/><rect x='${x + 9}' y='${y + 9}' width='6' height='6' rx='1.2' ${s}/>`;
    case "contacts":
      return `<circle cx='${x + 7.5}' cy='${y + 4.5}' r='3.5' ${s}/><path d='M${x + 1} ${y + 15.5}c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6' ${s}/>`;
    case "deals":
      return `<path d='M${x + 1} ${y + 8}l6.5-6.5 6.5 6.5-6.5 6.5z' ${s}/>`;
    case "tasks":
      return `<rect x='${x + 1}' y='${y + 1}' width='13' height='13' rx='2.5' ${s}/><path d='M${x + 4.5} ${y + 7.5}l2.5 2.5 4-4.5' ${s}/>`;
    case "reports":
      return `<path d='M${x + 2} ${y + 14}V${y + 8}M${x + 7.5} ${y + 14}V${y + 2}M${x + 13} ${y + 14}V${y + 6}' ${s}/>`;
    case "settings":
      return `<circle cx='${x + 7.5}' cy='${y + 7.5}' r='2.5' ${s}/><circle cx='${x + 7.5}' cy='${y + 7.5}' r='6.5' ${s} stroke-dasharray='3 2.2'/>`;
  }
}

function frame(opts: { active: Nav; search?: string; body: string }) {
  const nav = NAV.map((n, i) => {
    const y = 88 + i * 48;
    const active = n.id === opts.active;
    return `
      <rect x='12' y='${y}' width='196' height='40' rx='10' fill='${active ? c.accentSoft : "none"}'/>
      ${navIcon(28, y + 12, n.id, active ? c.accent : c.muted)}
      ${text(56, y + 25, n.label, { size: 14, weight: active ? 600 : 500, fill: active ? c.accent : c.text })}`;
  }).join("");

  const searchText = opts.search
    ? text(432, 33, opts.search, { size: 14, fill: c.text })
    : text(432, 33, "Search contacts, deals, tasks…", { size: 14, fill: c.subtle });

  return `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>
  <rect width='${W}' height='${H}' fill='${c.bg}'/>
  <!-- top bar -->
  <rect x='0' y='0' width='${W}' height='56' fill='${c.surface}'/>
  <line x1='0' y1='56.5' x2='${W}' y2='56.5' stroke='${c.border}'/>
  <circle cx='34' cy='28' r='11' fill='${c.accent}'/>
  <circle cx='34' cy='28' r='4.5' fill='#ffffff'/>
  <ellipse cx='34' cy='28' rx='15' ry='5.5' fill='none' stroke='${c.accent}' stroke-width='1.5' transform='rotate(-25 34 28)'/>
  ${text(58, 33, "Orbit CRM", { size: 16, weight: 700 })}
  <rect x='400' y='10' width='400' height='36' rx='10' fill='${c.bg}' stroke='${c.border}'/>
  <circle cx='418' cy='27' r='5' fill='none' stroke='${c.subtle}' stroke-width='1.8'/>
  <line x1='422' y1='31' x2='426' y2='35' stroke='${c.subtle}' stroke-width='1.8' stroke-linecap='round'/>
  ${searchText}
  ${opts.search ? `<rect x='776' y='21' width='14' height='14' rx='7' fill='${c.subtle}'/><path d='M780 25l6 6M786 25l-6 6' stroke='#ffffff' stroke-width='1.6' stroke-linecap='round'/>` : ""}
  <path d='M1112 20a6 6 0 0 1 12 0v6l2 3h-16l2-3z' fill='none' stroke='${c.muted}' stroke-width='1.6' stroke-linejoin='round'/>
  <circle cx='1124' cy='18' r='2.5' fill='${c.warning}'/>
  ${avatar(1160, 28, 14, "JR", c.success)}
  <!-- sidebar -->
  <rect x='0' y='57' width='220' height='${H - 57}' fill='${c.sidebar}'/>
  <line x1='220.5' y1='57' x2='220.5' y2='${H}' stroke='${c.border}'/>
  ${nav}
  <rect x='12' y='680' width='196' height='56' rx='12' fill='${c.surface}' stroke='${c.border}'/>
  ${avatar(40, 708, 14, "JR", c.success)}
  ${text(64, 704, "Jordan Reyes", { size: 13, weight: 600 })}
  ${text(64, 722, "Account manager", { size: 11, fill: c.muted })}
  <!-- content -->
  ${opts.body}
</svg>`;
}

interface Person {
  name: string;
  initials: string;
  company: string;
  role: string;
  last: string;
  color: string;
}

const PEOPLE: Person[] = [
  {
    name: "Maya Lindqvist",
    initials: "ML",
    company: "Northwind Bakery",
    role: "Marketing lead",
    last: "Call · Today",
    color: "#5b5bd6",
  },
  {
    name: "Tomas Herrera",
    initials: "TH",
    company: "Juniper Fitness",
    role: "Founder",
    last: "Email · Yesterday",
    color: "#0e9f6e",
  },
  {
    name: "Priya Raman",
    initials: "PR",
    company: "Cobalt Software",
    role: "Head of growth",
    last: "Meeting · 2 days ago",
    color: "#f05252",
  },
  {
    name: "Daniel Okafor",
    initials: "DO",
    company: "Harbor Dental",
    role: "Practice owner",
    last: "Note · 3 days ago",
    color: "#e3a008",
  },
  {
    name: "Elin Sato",
    initials: "ES",
    company: "Marigold Travel",
    role: "Brand manager",
    last: "Call · Last week",
    color: "#1c64f2",
  },
  {
    name: "Lucas Brandt",
    initials: "LB",
    company: "Pinecrest Realty",
    role: "Sales director",
    last: "Email · Last week",
    color: "#9061f9",
  },
];

function contactsTable(rows: Person[], highlightFirst: boolean) {
  const header = `
    <rect x='244' y='150' width='932' height='36' rx='0' fill='${c.sidebar}'/>
    ${text(268, 173, "NAME", { size: 11, weight: 600, fill: c.muted })}
    ${text(560, 173, "COMPANY", { size: 11, weight: 600, fill: c.muted })}
    ${text(800, 173, "ROLE", { size: 11, weight: 600, fill: c.muted })}
    ${text(1000, 173, "LAST ACTIVITY", { size: 11, weight: 600, fill: c.muted })}`;
  const body = rows
    .map((p, i) => {
      const y = 186 + i * 56;
      const hl = highlightFirst && i === 0;
      return `
      <rect x='244' y='${y}' width='932' height='56' fill='${hl ? c.accentSoft : c.surface}'/>
      <line x1='244' y1='${y + 56}' x2='1176' y2='${y + 56}' stroke='${c.border}'/>
      ${avatar(286, y + 28, 15, p.initials, p.color)}
      ${text(312, y + 33, p.name, { size: 14, weight: 600, fill: hl ? c.accent : c.text })}
      ${text(560, y + 33, p.company, { size: 14, fill: c.text })}
      ${text(800, y + 33, p.role, { size: 14, fill: c.muted })}
      ${text(1000, y + 33, p.last, { size: 13, fill: c.muted })}`;
    })
    .join("");
  const tableH = 36 + rows.length * 56;
  return `
    <rect x='244' y='150' width='932' height='${tableH}' rx='12' fill='${c.surface}' stroke='${c.border}'/>
    <clipPath id='tbl'><rect x='244' y='150' width='932' height='${tableH}' rx='12'/></clipPath>
    <g clip-path='url(#tbl)'>${header}${body}</g>`;
}

/* ------------------------------------------------------------------ screens */

export const crmDashboardSvg = frame({
  active: "dashboard",
  body: `
    ${text(244, 112, "Good morning, Jordan", { size: 24, weight: 700 })}
    ${text(244, 136, "Here is what is happening across your accounts today.", { size: 14, fill: c.muted })}
    ${[
      ["Open deals", "18", "+3 this week"],
      ["Pipeline value", "$142k", "+12%"],
      ["Tasks due today", "6", "2 overdue"],
      ["Calls logged", "27", "this week"],
    ]
      .map(
        ([label, value, delta], i) => `
      <rect x='${244 + i * 236}' y='160' width='224' height='104' rx='12' fill='${c.surface}' stroke='${c.border}'/>
      ${text(264 + i * 236, 190, label!, { size: 12, weight: 600, fill: c.muted })}
      ${text(264 + i * 236, 228, value!, { size: 26, weight: 700 })}
      ${text(264 + i * 236, 250, delta!, { size: 12, fill: i === 2 ? c.warning : c.success })}`,
      )
      .join("")}
    <rect x='244' y='288' width='612' height='440' rx='12' fill='${c.surface}' stroke='${c.border}'/>
    ${text(268, 320, "Pipeline by stage", { size: 15, weight: 600 })}
    ${[
      ["Qualified", 320],
      ["Proposal", 420],
      ["Negotiation", 250],
      ["Won", 180],
    ]
      .map(
        ([label, w], i) => `
      ${text(268, 372 + i * 64, label as string, { size: 13, fill: c.muted })}
      <rect x='380' y='${356 + i * 64}' width='440' height='22' rx='6' fill='${c.sidebar}'/>
      <rect x='380' y='${356 + i * 64}' width='${w}' height='22' rx='6' fill='${c.accent}' opacity='${1 - i * 0.18}'/>`,
      )
      .join("")}
    <rect x='880' y='288' width='296' height='440' rx='12' fill='${c.surface}' stroke='${c.border}'/>
    ${text(904, 320, "Today's tasks", { size: 15, weight: 600 })}
    ${[
      "Send proposal to Cobalt Software",
      "Follow up with Harbor Dental",
      "Prepare Q3 review deck",
      "Call Maya about launch",
      "Update Juniper deal stage",
    ]
      .map(
        (t, i) => `
      <rect x='904' y='${346 + i * 54}' width='16' height='16' rx='4' fill='none' stroke='${c.subtle}' stroke-width='1.6'/>
      ${text(932, 359 + i * 54, t, { size: 13 })}`,
      )
      .join("")}`,
});

export const crmContactsListSvg = frame({
  active: "contacts",
  body: `
    ${text(244, 112, "Contacts", { size: 24, weight: 700 })}
    ${text(244, 136, "248 people across 61 companies", { size: 14, fill: c.muted })}
    <rect x='1056' y='96' width='120' height='36' rx='10' fill='${c.accent}'/>
    ${text(1116, 119, "+ New contact", { size: 13, weight: 600, fill: "#ffffff", anchor: "middle" })}
    ${contactsTable(PEOPLE, false)}
    ${text(244, 560, "Showing 6 of 248", { size: 12, fill: c.subtle })}`,
});

export const crmContactSearchSvg = frame({
  active: "contacts",
  search: "Maya",
  body: `
    ${text(244, 112, "Contacts", { size: 24, weight: 700 })}
    ${text(244, 136, "1 result for “Maya”", { size: 14, fill: c.muted })}
    <rect x='1056' y='96' width='120' height='36' rx='10' fill='${c.accent}'/>
    ${text(1116, 119, "+ New contact", { size: 13, weight: 600, fill: "#ffffff", anchor: "middle" })}
    ${contactsTable(PEOPLE.slice(0, 1), true)}
    ${text(244, 272, "Tip: press Enter to open the first result", { size: 12, fill: c.subtle })}`,
});

function detailHeader(activeTab: "overview" | "activity") {
  const tabs: [string, number, "overview" | "activity" | "deals"][] = [
    ["Overview", 268, "overview"],
    ["Activity", 386, "activity"],
    ["Deals", 504, "deals"],
  ];
  return `
    ${text(244, 92, "Contacts  ›  Maya Lindqvist", { size: 12, fill: c.subtle })}
    ${avatar(268, 126, 22, "ML", "#5b5bd6")}
    ${text(304, 122, "Maya Lindqvist", { size: 22, weight: 700 })}
    ${text(304, 142, "Marketing lead · Northwind Bakery", { size: 13, fill: c.muted })}
    <rect x='1032' y='104' width='144' height='36' rx='10' fill='${c.surface}' stroke='${c.border}'/>
    ${text(1104, 127, "Log activity", { size: 13, weight: 600, anchor: "middle" })}
    <line x1='244' y1='210.5' x2='1176' y2='210.5' stroke='${c.border}'/>
    ${tabs
      .map(([label, x, id]) => {
        const active = id === activeTab;
        return `
      <rect x='${x}' y='170' width='102' height='40' rx='8' fill='${active ? c.accentSoft : "none"}'/>
      ${text(x + 51, 195, label, { size: 14, weight: active ? 600 : 500, fill: active ? c.accent : c.muted, anchor: "middle" })}
      ${active ? `<rect x='${x}' y='208' width='102' height='3' rx='1.5' fill='${c.accent}'/>` : ""}`;
      })
      .join("")}`;
}

export const crmContactDetailSvg = frame({
  active: "contacts",
  body: `
    ${detailHeader("overview")}
    <rect x='244' y='236' width='560' height='240' rx='12' fill='${c.surface}' stroke='${c.border}'/>
    ${text(268, 268, "Details", { size: 15, weight: 600 })}
    ${[
      ["Email", "maya.lindqvist@northwindbakery.example"],
      ["Phone", "+46 70 123 45 67"],
      ["Location", "Malmö, Sweden"],
      ["Owner", "Jordan Reyes"],
      ["Lifecycle stage", "Customer"],
    ]
      .map(
        ([k, v], i) => `
      ${text(268, 304 + i * 32, k!, { size: 13, fill: c.muted })}
      ${text(420, 304 + i * 32, v!, { size: 13, weight: 500 })}`,
      )
      .join("")}
    <rect x='828' y='236' width='348' height='240' rx='12' fill='${c.surface}' stroke='${c.border}'/>
    ${text(852, 268, "Open deals", { size: 15, weight: 600 })}
    <rect x='852' y='288' width='300' height='64' rx='10' fill='${c.bg}'/>
    ${text(868, 312, "Spring launch campaign", { size: 13, weight: 600 })}
    ${text(868, 332, "$24,000 · Proposal", { size: 12, fill: c.muted })}
    <rect x='852' y='364' width='300' height='64' rx='10' fill='${c.bg}'/>
    ${text(868, 388, "Loyalty app retainer", { size: 13, weight: 600 })}
    ${text(868, 408, "$8,500 / mo · Negotiation", { size: 12, fill: c.muted })}
    <rect x='244' y='500' width='932' height='220' rx='12' fill='${c.surface}' stroke='${c.border}'/>
    ${text(268, 532, "Notes", { size: 15, weight: 600 })}
    ${text(268, 566, "Prefers short status updates on Fridays. Wants the spring launch to focus on the new sourdough range.", { size: 13, fill: c.text })}
    ${text(268, 590, "Decision maker for all marketing spend; CFO signs off above $20k.", { size: 13, fill: c.text })}`,
});

export const crmActivityTabSvg = frame({
  active: "contacts",
  body: `
    ${detailHeader("activity")}
    <line x1='254' y1='250' x2='254' y2='720' stroke='${c.border}' stroke-width='2'/>
    <!-- last call note (walkthrough target) -->
    <circle cx='254' cy='262' r='8' fill='${c.success}'/>
    <rect x='268' y='240' width='882' height='90' rx='12' fill='${c.surface}' stroke='${c.success}' stroke-width='1.5'/>
    <rect x='284' y='254' width='46' height='20' rx='6' fill='${c.successSoft}'/>
    ${text(307, 268, "Call", { size: 11, weight: 600, fill: "#027a48", anchor: "middle" })}
    ${text(340, 268, "Today, 10:15 · 14 min · Jordan Reyes", { size: 12, fill: c.muted })}
    ${text(284, 296, "Maya confirmed the spring launch budget. She wants the first creative concepts by next Thursday", { size: 13 })}
    ${text(284, 316, "and asked us to include the sourdough range in every hero visual.", { size: 13 })}
    <circle cx='254' cy='368' r='8' fill='${c.accent}'/>
    <rect x='268' y='346' width='882' height='78' rx='12' fill='${c.surface}' stroke='${c.border}'/>
    <rect x='284' y='360' width='52' height='20' rx='6' fill='${c.accentSoft}'/>
    ${text(310, 374, "Email", { size: 11, weight: 600, fill: c.accent, anchor: "middle" })}
    ${text(346, 374, "Yesterday, 16:40 · Sent by Jordan Reyes", { size: 12, fill: c.muted })}
    ${text(284, 404, "Proposal v2 sent — includes the revised media plan and the loyalty app timeline.", { size: 13 })}
    <circle cx='254' cy='462' r='8' fill='${c.warning}'/>
    <rect x='268' y='440' width='882' height='78' rx='12' fill='${c.surface}' stroke='${c.border}'/>
    <rect x='284' y='454' width='64' height='20' rx='6' fill='${c.warningSoft}'/>
    ${text(316, 468, "Meeting", { size: 11, weight: 600, fill: "#b54708", anchor: "middle" })}
    ${text(358, 468, "Mon, 09:00 · Kick-off · 45 min", { size: 12, fill: c.muted })}
    ${text(284, 498, "Walked through goals for the season: +20% online orders, launch two new store locations.", { size: 13 })}
    <circle cx='254' cy='556' r='8' fill='${c.subtle}'/>
    <rect x='268' y='534' width='882' height='78' rx='12' fill='${c.surface}' stroke='${c.border}'/>
    <rect x='284' y='548' width='46' height='20' rx='6' fill='${c.sidebar}'/>
    ${text(307, 562, "Note", { size: 11, weight: 600, fill: c.muted, anchor: "middle" })}
    ${text(340, 562, "Last week · Jordan Reyes", { size: 12, fill: c.muted })}
    ${text(284, 592, "Contact imported from the trade-show list. Interested in seasonal campaigns.", { size: 13 })}`,
});

/* ---------------------------------------------------------------- data URIs */

function toDataUri(svg: string): string {
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

export const crmDashboardDataUri = toDataUri(crmDashboardSvg);
export const crmContactsListDataUri = toDataUri(crmContactsListSvg);
export const crmContactSearchDataUri = toDataUri(crmContactSearchSvg);
export const crmContactDetailDataUri = toDataUri(crmContactDetailSvg);
export const crmActivityTabDataUri = toDataUri(crmActivityTabSvg);
