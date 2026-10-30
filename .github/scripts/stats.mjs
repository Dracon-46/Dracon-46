// Gera os cards de estatísticas e de linguagens do perfil (SVG) direto da API do GitHub,
// sem depender de serviços externos. Roda no workflow da cobrinha e publica na branch "output".
//
// Uso: GITHUB_TOKEN=... node .github/scripts/stats.mjs <usuario> <pasta-de-saida>
// Para testar sem token: STATS_FIXTURE=dados.json node .github/scripts/stats.mjs <usuario> <pasta>

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [login = 'Dracon-46', outDir = 'dist'] = process.argv.slice(2);

const ACCENT = '#00A6FF';
const FONT = "'Segoe UI', Ubuntu, 'Helvetica Neue', Arial, sans-serif";
const HIDDEN_LANGS = new Set(['Mermaid']);

// Ícones Lucide (ISC), só o conteúdo interno do SVG 24x24
const ICONS = {
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16m-3-4V9m-5 8V5M8 17v-3"/>',
  commit: '<circle cx="12" cy="12" r="3"/><path d="M3 12h6m6 0h6"/>',
  pr: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7M6 9v12"/>',
  issue: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="12" r="10"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z"/>',
  repo: '<path d="M10 2v8l3-3l3 3V2"/><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3.128a4 4 0 0 1 0 7.744M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  code: '<path d="m18 16l4-4l-4-4M6 8l-4 4l4 4m8.5-12l-5 16"/>',
};

const QUERY = `query($login: String!, $after: String) {
  user(login: $login) {
    createdAt
    followers { totalCount }
    pullRequests { totalCount }
    issues { totalCount }
    contributionsCollection {
      totalCommitContributions
      restrictedContributionsCount
      contributionCalendar { totalContributions }
    }
    repositories(ownerAffiliations: OWNER, isFork: false, first: 100, after: $after) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        stargazerCount
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name color } }
        }
      }
    }
  }
}`;

async function fetchUser() {
  if (process.env.STATS_FIXTURE) return JSON.parse(readFileSync(process.env.STATS_FIXTURE, 'utf8'));
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN não definido');

  let user, after = null;
  const repos = [];
  do {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { login, after } }),
    });
    const json = await res.json();
    if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? json));
    user = json.data.user;
    repos.push(...user.repositories.nodes);
    after = user.repositories.pageInfo.hasNextPage ? user.repositories.pageInfo.endCursor : null;
  } while (after);
  user.repositories.nodes = repos;
  return user;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (n) => n.toLocaleString('pt-BR');
const icon = (name, x, y, color = ACCENT, size = 16) =>
  `<g transform="translate(${x},${y}) scale(${size / 24})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</g>`;

function frame(width, height, title, iconName, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">
  <title>${esc(title)}</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d1117"/><stop offset="1" stop-color="#161b22"/></linearGradient>
    <radialGradient id="glow" cx="1" cy="0" r=".9"><stop offset="0" stop-color="${ACCENT}" stop-opacity=".16"/><stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/></radialGradient>
  </defs>
  <style>
    .title { font: 700 16px ${FONT}; fill: #ffffff; }
    .label { font: 400 13.5px ${FONT}; fill: #c9d1d9; }
    .value { font: 700 13.5px ${FONT}; fill: #ffffff; }
    .big { font: 800 34px ${FONT}; fill: #ffffff; }
    .small { font: 400 12px ${FONT}; fill: #8b949e; }
    .row { opacity: 0; animation: in .5s ease-out forwards; }
    @keyframes in { from { opacity: 0; transform: translateX(-6px) } to { opacity: 1; transform: none } }
  </style>
  <rect width="${width}" height="${height}" rx="14" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" rx="14" fill="url(#glow)"/>
  <rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13.5" fill="none" stroke="${ACCENT}" stroke-opacity=".35"/>
  ${icon(iconName, 24, 22, ACCENT, 18)}
  <text x="50" y="37" class="title">${esc(title)}</text>
  ${body}
</svg>
`;
}

function statsCard(u) {
  const stars = u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0);
  const since = new Date(u.createdAt).getFullYear();
  const c = u.contributionsCollection;
  const rows = [
    ['commit', 'Commits no último ano', c.totalCommitContributions + c.restrictedContributionsCount],
    ['pr', 'Pull requests', u.pullRequests.totalCount],
    ['issue', 'Issues', u.issues.totalCount],
    ['repo', 'Repositórios', u.repositories.totalCount],
    ['star', 'Estrelas recebidas', stars],
    ['users', 'Seguidores', u.followers.totalCount],
  ];
  const list = rows.map(([ic, label, value], i) => {
    const y = 68 + i * 27;
    return `<g class="row" style="animation-delay:${150 + i * 90}ms">${icon(ic, 24, y - 12, ACCENT, 16)}<text x="50" y="${y}" class="label">${esc(label)}</text><text x="246" y="${y}" class="value" text-anchor="end">${fmt(value)}</text></g>`;
  }).join('\n  ');

  const highlight = `
  <line x1="272" y1="58" x2="272" y2="210" stroke="#30363d"/>
  <g transform="translate(346,0)">
    <circle cx="0" cy="118" r="52" fill="none" stroke="#30363d" stroke-width="6"/>
    <circle cx="0" cy="118" r="52" fill="none" stroke="${ACCENT}" stroke-width="6" stroke-linecap="round" stroke-dasharray="327" stroke-dashoffset="327" transform="rotate(-90 0 118)">
      <animate attributeName="stroke-dashoffset" from="327" to="0" dur="1.2s" fill="freeze"/>
    </circle>
    <text x="0" y="122" class="big" text-anchor="middle" style="font-size:26px">${fmt(c.contributionCalendar.totalContributions)}</text>
    <text x="0" y="140" class="small" text-anchor="middle">contribuições</text>
    <text x="0" y="196" class="small" text-anchor="middle">no último ano · desde ${since}</text>
  </g>`;

  return frame(440, 232, 'Estatísticas no GitHub', 'chart', list + highlight);
}

function langsCard(u) {
  const totals = new Map();
  for (const repo of u.repositories.nodes) {
    for (const { size, node } of repo.languages.edges) {
      if (HIDDEN_LANGS.has(node.name)) continue;
      const cur = totals.get(node.name) ?? { size: 0, color: node.color ?? '#8b949e' };
      cur.size += size;
      totals.set(node.name, cur);
    }
  }
  const all = [...totals.entries()].sort((a, b) => b[1].size - a[1].size);
  const sum = all.reduce((s, [, v]) => s + v.size, 0) || 1;
  const top = all.slice(0, 8);

  const W = 440, barX = 24, barW = W - 48;
  let x = barX;
  const segments = top.map(([, v]) => {
    const w = (v.size / sum) * barW;
    const seg = `<rect x="${x.toFixed(2)}" y="56" width="${Math.max(w, 0).toFixed(2)}" height="10" fill="${v.color}"/>`;
    x += w;
    return seg;
  }).join('');

  const list = top.map(([name, v], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const lx = 24 + col * 202, ly = 96 + row * 28;
    const pct = ((v.size / sum) * 100).toFixed(1).replace('.', ',');
    return `<g class="row" style="animation-delay:${150 + i * 70}ms"><circle cx="${lx + 5}" cy="${ly - 4}" r="5" fill="${v.color}"/><text x="${lx + 18}" y="${ly}" class="label">${esc(name)}</text><text x="${lx + 190}" y="${ly}" class="value" text-anchor="end">${pct}%</text></g>`;
  }).join('\n  ');

  const body = `<clipPath id="bar"><rect x="${barX}" y="56" width="${barW}" height="10" rx="5"/></clipPath>
  <rect x="${barX}" y="56" width="${barW}" height="10" rx="5" fill="#30363d"/>
  <g clip-path="url(#bar)">${segments}</g>
  ${list}`;
  return frame(W, 232, 'Linguagens mais usadas', 'code', body);
}

const user = await fetchUser();
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'stats.svg'), statsCard(user));
writeFileSync(join(outDir, 'top-langs.svg'), langsCard(user));
console.log(`cards gerados em ${outDir}/`);
