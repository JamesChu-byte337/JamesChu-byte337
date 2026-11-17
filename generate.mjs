// Builds the profile README and its SVG cards from live GitHub data.
// Run: GH_TOKEN=<token> node generate.mjs   (the GitHub Action does this daily)

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const LOGIN = 'JamesChu-byte337';
const PROGRAM = 'Electrical Engineering';
const UNIVERSITY = 'University of Waterloo';
const MAX_PROJECTS = 4;

const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error('Set GH_TOKEN or GITHUB_TOKEN');

// ---------- data ----------

const QUERY = `query($login:String!){
  user(login:$login){
    name avatarUrl(size:176)
    pullRequests{totalCount}
    repositories(ownerAffiliations:OWNER,isFork:false,privacy:PUBLIC,first:100,
                 orderBy:{field:PUSHED_AT,direction:DESC}){
      nodes{
        name description url stargazerCount
        primaryLanguage{name color}
        defaultBranchRef{target{... on Commit{history(first:10){nodes{messageHeadline committedDate}}}}}
      }
    }
    contributionsCollection{
      totalCommitContributions
      contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}
    }
  }
}`;

async function fetchData() {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'User-Agent': 'profile-readme' },
    body: JSON.stringify({ query: QUERY, variables: { login: LOGIN } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors || json));
  const user = json.data.user;

  const avatarRes = await fetch(user.avatarUrl);
  const avatarType = avatarRes.headers.get('content-type') || 'image/png';
  const avatar = `data:${avatarType};base64,${Buffer.from(await avatarRes.arrayBuffer()).toString('base64')}`;

  const repos = user.repositories.nodes;
  const projects = repos.filter(r => r.name !== LOGIN);

  const commits = projects
    .flatMap(r => (r.defaultBranchRef?.target?.history?.nodes || []).map(c => ({
      repo: r.name, message: c.messageHeadline, date: c.committedDate,
    })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  const languages = [];
  for (const r of repos) {
    const l = r.primaryLanguage;
    if (l && !languages.some(x => x.name === l.name)) languages.push(l);
  }

  const today = new Date().toISOString().slice(0, 10);
  const weeks = user.contributionsCollection.contributionCalendar.weeks;
  const days = weeks.flatMap(w => w.contributionDays).filter(d => d.date <= today);
  let best = 0, run = 0;
  for (const d of days) { run = d.contributionCount ? run + 1 : 0; best = Math.max(best, run); }
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].contributionCount) current++;
    else if (i !== days.length - 1) break; // an empty today doesn't end the streak yet
  }

  return {
    name: user.name || LOGIN,
    avatar,
    projects: projects.slice(0, MAX_PROJECTS),
    commits,
    languages,
    weeks,
    stats: {
      commits: user.contributionsCollection.totalCommitContributions,
      prs: user.pullRequests.totalCount,
      stars: repos.reduce((n, r) => n + r.stargazerCount, 0),
      best, current,
      year: user.contributionsCollection.contributionCalendar.totalContributions,
    },
  };
}

// ---------- drawing helpers ----------

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const r = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;

const MONO = `ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace`;
const SANS = `-apple-system,'Segoe UI',Helvetica,Arial,sans-serif`;
const GREEN = '#3fb950';
const C = { card: '#0f1620', border: '#232b38', text: '#f0f6fc', dim: '#8b949e', body: '#c9d1d9' };

// 5x7 pixel font
const GLYPHS = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.', D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.###.', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '#####|..#..|..#..|..#..|..#..|..#..|#####', J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.', P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', 1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  2: '.###.|#...#|....#|...#.|..#..|.#...|#####', 3: '####.|....#|....#|.###.|....#|....#|####.',
  4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', 5: '#####|#....|####.|....#|....#|#...#|.###.',
  6: '.###.|#....|#....|####.|#...#|#...#|.###.', 7: '#####|....#|...#.|..#..|.#...|.#...|.#...',
  8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.', 9: '.###.|#...#|#...#|.####|....#|....#|.###.',
  '>': '#....|.#...|..#..|...#.|..#..|.#...|#....', '-': '.....|.....|.....|#####|.....|.....|.....',
  ' ': '.....|.....|.....|.....|.....|.....|.....',
};
const pixelWidth = (text, s) => text.length * 6 * s - s;
function pixelText(text, x, y, s, fill) {
  let d = '';
  [...text.toUpperCase()].forEach((ch, i) => {
    (GLYPHS[ch] || GLYPHS[' ']).split('|').forEach((row, ry) => {
      [...row].forEach((px, rx) => {
        if (px === '#') d += `M${x + (i * 6 + rx) * s} ${y + ry * s}h${s}v${s}h-${s}z`;
      });
    });
  });
  return `<path d="${d}" fill="${fill}" shape-rendering="crispEdges"/>`;
}

const svg = (w, h, body, label) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">\n${body}\n</svg>\n`;
const card = (w, h) => `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="10" fill="${C.card}" stroke="${C.border}"/>`;

// ---------- banner ----------

function banner(d) {
  const W = 840, H = 420;
  const p = [];

  // wall + floor
  p.push(r(0, 0, W, H, '#1b1d33'));
  for (let x = 20; x < W; x += 28) p.push(r(x, 0, 4, 336, '#171930'));
  p.push(r(0, 336, W, 84, '#4a2a1c'), r(0, 336, W, 6, '#6b3d26'));
  for (const y of [362, 390]) p.push(r(0, y, W, 2, '#3a2015'));
  for (const [x, y, h] of [[150, 342, 20], [520, 342, 20], [330, 364, 26], [700, 364, 26], [90, 392, 28], [460, 392, 28]]) p.push(r(x, y, 2, h, '#3a2015'));

  // window with night sky
  p.push(r(32, 48, 196, 156, '#0c0d16'));
  for (const [x, y] of [[40, 56], [134, 56], [40, 130], [134, 130]]) p.push(r(x, y, 86, 66, '#0b1a4a'));
  p.push(r(176, 68, 6, 18, '#f4ead2'), r(182, 80, 12, 6, '#f4ead2')); // moon
  [[62, 78, 0], [104, 104, 1.2], [156, 64, 2.1], [206, 106, 0.6], [70, 160, 1.7], [112, 142, 2.6], [150, 176, 0.9], [198, 150, 2.3]]
    .forEach(([x, y, delay]) => p.push(r(x, y, 3, 3, '#dfe6ff', `class="star" style="animation-delay:${delay}s"`)));
  p.push(r(24, 204, 212, 10, '#6b4a33'), r(24, 214, 212, 4, '#4f3524'));

  // name sign
  const name = d.name.toUpperCase();
  const signW = pixelWidth(name, 4) + 36;
  const signX = Math.round((W - signW) / 2);
  p.push(r(signX, 36, signW, 48, '#14141f'), r(signX + 4, 40, signW - 8, 40, '#f4ead2'));
  p.push(pixelText(name, signX + 18, 46, 4, '#14141f'));

  // clock
  p.push(`<circle cx="734" cy="78" r="25" fill="#f4ead2" stroke="#14141f" stroke-width="5"/>`);
  p.push(r(732, 62, 4, 18, '#14141f'), r(732, 76, 14, 4, '#14141f'));

  // shelves, one book per language
  for (const y of [176, 238]) p.push(r(650, y, 160, 8, '#7a4a2c'), r(650, y + 8, 160, 3, '#4f2f1c'));
  d.languages.slice(0, 10).forEach((l, i) => {
    const h = [44, 34, 40, 30, 46, 36, 42, 32, 38, 28][i];
    const x = 658 + i * 14;
    p.push(r(x, 176 - h, 12, h, l.color || '#8b949e'), r(x, 176 - h + 6, 12, 3, 'rgba(0,0,0,.25)'));
  });
  p.push(r(668, 218, 26, 20, '#3d4763'), r(672, 222, 18, 4, '#f4ead2'), r(770, 226, 30, 12, '#8a5a3c')); // box + tray

  // lamp
  p.push(`<polygon points="250,172 300,172 344,272 226,272" fill="#f5cf5b" opacity=".07"/>`);
  p.push(r(270, 172, 6, 96, '#4a4f63'), r(258, 266, 30, 6, '#4a4f63'));
  p.push(`<polygon points="256,150 290,150 300,172 246,172" fill="#f5cf5b"/>`);

  // monitor
  p.push(r(304, 100, 232, 150, '#3a3f52'), r(312, 108, 216, 134, '#07110d'));
  p.push(r(412, 250, 16, 18, '#3a3f52'), r(388, 266, 64, 6, '#2c3040'));
  const LH = 15;
  let lines = [{ t: '$ git log --oneline', c: '#e6ffed' },
    ...d.commits.map(c => ({ t: clip(`${clip(c.repo, 15).replace('…', '')}: ${c.message}`, 34), c: '#4ade80' }))];
  const base = lines.slice();
  while (lines.length < 10) lines = lines.concat(base);
  const loop = lines.length * LH;
  const text = lines.concat(lines).map((l, i) =>
    `<text x="320" y="${122 + i * LH}" fill="${l.c}">${esc(l.t)}</text>`).join('');
  p.push(`<clipPath id="screen"><rect x="312" y="108" width="216" height="134"/></clipPath>`);
  p.push(`<g clip-path="url(#screen)"><g class="roll" font-family="${MONO}" font-size="10" font-weight="600">${text}</g></g>`);
  p.push(r(312, 108, 216, 12, 'url(#fadeTop)'), r(312, 230, 216, 12, 'url(#fadeBottom)'));

  // desk
  p.push(r(240, 272, 360, 14, '#7a4a2c'), r(240, 286, 360, 6, '#5c3620'));
  p.push(r(252, 292, 12, 50, '#5c3620'), r(576, 292, 12, 50, '#5c3620'));

  // mug + steam
  p.push(r(552, 252, 20, 20, '#e8e2d0'), r(572, 256, 8, 4, '#e8e2d0'), r(576, 260, 4, 6, '#e8e2d0'), r(572, 264, 8, 4, '#e8e2d0'));
  p.push(r(556, 240, 3, 6, '#cfd3e6', 'class="steam"'), r(564, 238, 3, 6, '#cfd3e6', 'class="steam" style="animation-delay:1.3s"'));

  // chair
  p.push(r(444, 258, 8, 46, '#2a2e3d'), r(380, 300, 76, 10, '#2f3344'), r(414, 310, 8, 30, '#2a2e3d'), r(392, 340, 52, 6, '#2a2e3d'));

  // plant
  p.push(r(152, 232, 6, 62, '#2f9e44'));
  for (const [x, y, w] of [[146, 224, 18], [134, 242, 18], [158, 250, 20], [132, 262, 20], [158, 272, 18]]) p.push(r(x, y, w, 8, '#37b24d'));
  p.push(r(128, 290, 54, 8, '#8c4a30'), r(132, 298, 46, 38, '#a85a3a'));

  // sleeping cat
  p.push(r(652, 326, 26, 6, '#d98f48'), r(676, 312, 56, 24, '#e8a45c'), r(722, 302, 26, 24, '#e8a45c'));
  p.push(r(722, 296, 6, 6, '#e8a45c'), r(742, 296, 6, 6, '#e8a45c'));
  p.push(r(690, 312, 4, 10, '#d98f48'), r(702, 312, 4, 10, '#d98f48'), r(730, 314, 6, 2, '#3a2015'), r(740, 314, 6, 2, '#3a2015'));
  p.push(`<text x="756" y="292" class="zz" font-family="${MONO}" font-size="16" font-weight="700" fill="#aab2d5">z</text>`);
  p.push(`<text x="766" y="276" class="zz" style="animation-delay:1.5s" font-family="${MONO}" font-size="12" font-weight="700" fill="#aab2d5">z</text>`);

  const defs = `<defs>
<linearGradient id="fadeTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07110d"/><stop offset="1" stop-color="#07110d" stop-opacity="0"/></linearGradient>
<linearGradient id="fadeBottom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07110d" stop-opacity="0"/><stop offset="1" stop-color="#07110d"/></linearGradient>
<clipPath id="frame"><rect width="${W}" height="${H}" rx="12"/></clipPath>
<style>
.roll{animation:roll ${(lines.length * 1.5).toFixed(1)}s linear infinite}
@keyframes roll{to{transform:translateY(-${loop}px)}}
.star{animation:twinkle 3s ease-in-out infinite}
@keyframes twinkle{50%{opacity:.15}}
.steam{opacity:0;animation:steam 2.6s ease-out infinite}
@keyframes steam{20%{opacity:.7}100%{opacity:0;transform:translateY(-14px)}}
.zz{opacity:0;animation:zz 3s ease-out infinite}
@keyframes zz{20%{opacity:1}100%{opacity:0;transform:translate(8px,-18px)}}
@media (prefers-reduced-motion:reduce){.star,.steam,.zz{animation:none}}
</style>
</defs>`;
  return svg(W, H, `${defs}\n<g clip-path="url(#frame)" shape-rendering="crispEdges">\n${p.join('\n')}\n</g>`,
    `Pixel-art room for ${d.name}; the monitor scrolls recent commits`);
}

// ---------- cards ----------

function about(d) {
  const W = 840, H = 150;
  return svg(W, H, [
    card(W, H),
    pixelText('> ABOUT', 28, 26, 2, GREEN),
    `<text x="28" y="84" font-family="${SANS}" font-size="26" font-weight="700" fill="${C.text}">${esc(d.name)}</text>`,
    `<text x="28" y="110" font-family="${SANS}" font-size="15" fill="${C.body}">${esc(PROGRAM)}</text>`,
    `<text x="28" y="131" font-family="${SANS}" font-size="15" fill="${C.dim}">${esc(UNIVERSITY)}</text>`,
    r(718, 27, 96, 96, '#f0f6fc'), r(721, 30, 90, 90, C.card),
    `<image x="724" y="33" width="84" height="84" href="${d.avatar}"/>`,
  ].join('\n'), `About: ${d.name}, ${PROGRAM}, ${UNIVERSITY}`);
}

function stats(d) {
  const W = 840, H = 92;
  const items = [[d.stats.commits, 'COMMITS'], [d.stats.prs, 'PULL REQS'], [d.stats.stars, 'STARS'], [`${d.stats.best}D`, 'BEST STREAK']];
  const body = items.map(([n, label], i) => {
    const x = 28 + i * 204;
    return pixelText(String(n), x, 16, 4, C.text) + pixelText(label, x, 58, 2, C.dim);
  });
  return svg(W, H, card(W, H) + '\n' + body.join('\n'), items.map(([n, l]) => `${n} ${l.toLowerCase()}`).join(', '));
}

function heading(title) {
  const W = 840, H = 36;
  const x = 4 + pixelWidth(`> ${title}`, 3) + 14;
  return svg(W, H, pixelText(`> ${title}`, 4, 8, 3, GREEN) +
    `<line x1="${x}" y1="19" x2="${W - 4}" y2="19" stroke="${C.border}" stroke-width="2" stroke-dasharray="6 5"/>`, title);
}

function wrap(textIn, perLine, maxLines) {
  const words = textIn.split(/\s+/), out = [''];
  for (const w of words) {
    const cur = out[out.length - 1];
    if (!cur) out[out.length - 1] = w;
    else if ((cur + ' ' + w).length <= perLine) out[out.length - 1] = cur + ' ' + w;
    else out.push(w);
  }
  if (out.length > maxLines) {
    out.length = maxLines;
    out[maxLines - 1] = clip(out[maxLines - 1] + ' …', perLine).replace(/\s*…+$/, '…');
  }
  return out.map(l => clip(l, perLine + 2));
}

function project(repo) {
  const W = 414, H = 140;
  const hash = createHash('sha1').update(repo.name).digest();
  const hue = (hash[0] * 256 + hash[1]) % 360;
  const cells = [];
  for (let y = 0; y < 7; y++) for (let x = 0; x < 4; x++) {
    if ((hash[2 + ((y * 4 + x) >> 3)] >> ((y * 4 + x) & 7)) & 1) {
      cells.push(r(24 + x * 8, 32 + y * 8, 8, 8, `hsl(${hue},75%,62%)`));
      if (x < 3) cells.push(r(24 + (6 - x) * 8, 32 + y * 8, 8, 8, `hsl(${hue},75%,62%)`));
    }
  }
  const desc = wrap(repo.description || 'No description yet.', 42, 3).map((l, i) =>
    `<text x="112" y="${58 + i * 16}" font-family="${SANS}" font-size="12" fill="${C.dim}">${esc(l)}</text>`);
  const lang = repo.primaryLanguage;
  return svg(W, H, [
    card(W, H),
    `<rect x="14" y="22" width="76" height="76" rx="6" fill="hsl(${hue},45%,16%)"/>`,
    `<g shape-rendering="crispEdges">${cells.join('')}</g>`,
    `<text x="112" y="36" font-family="${MONO}" font-size="13" font-weight="700" fill="${C.text}">${esc(clip(repo.name, 32))}</text>`,
    ...desc,
    `<text x="112" y="122" font-family="${MONO}" font-size="13" font-weight="700" fill="${GREEN}">★ ${repo.stargazerCount}</text>`,
    lang ? `<circle cx="${396 - lang.name.length * 6.6 - 10}" cy="118" r="5" fill="${lang.color || C.dim}"/>` +
      `<text x="398" y="122" text-anchor="end" font-family="${MONO}" font-size="11" fill="${C.dim}">${esc(lang.name)}</text>` : '',
  ].join('\n'), `${repo.name}: ${repo.description || ''}`);
}

function activity(d) {
  const W = 840, H = 190;
  const weeks = d.weeks.slice(-26);
  const max = Math.max(1, ...weeks.flatMap(w => w.contributionDays.map(x => x.contributionCount)));
  const shades = ['#1b2330', '#0e4429', '#006d32', '#26a641', '#39d353'];
  const cells = weeks.flatMap((w, wi) => w.contributionDays.map(day => {
    const n = day.contributionCount;
    const level = n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4));
    return `<rect x="${28 + wi * 15}" y="${58 + new Date(day.date + 'T00:00:00Z').getUTCDay() * 15}" width="12" height="12" rx="2" fill="${shades[level]}"/>`;
  }));
  const side = [['CURRENT STREAK', `${d.stats.current} day${d.stats.current === 1 ? '' : 's'}`],
    ['BEST STREAK', `${d.stats.best} day${d.stats.best === 1 ? '' : 's'}`], ['PAST YEAR', `${d.stats.year} contributions`]]
    .map(([label, value], i) =>
      `<text x="480" y="${66 + i * 42}" font-family="${MONO}" font-size="10" letter-spacing="1.2" fill="${C.dim}">${label}</text>` +
      `<text x="480" y="${86 + i * 42}" font-family="${SANS}" font-size="18" font-weight="700" fill="${C.text}">${esc(value)}</text>`);
  return svg(W, H, [card(W, H), pixelText('> ACTIVITY', 28, 26, 2, GREEN), ...cells, ...side].join('\n'),
    `Activity: ${d.stats.year} contributions in the past year, best streak ${d.stats.best} days`);
}

// ---------- README ----------

function readme(d) {
  const cards = d.projects.map((p, i) =>
    `<a href="${p.url}"><img src="assets/project-${i + 1}.svg" width="49%" alt="${esc(p.name)}"></a>`);
  const rows = [];
  for (let i = 0; i < cards.length; i += 2) rows.push(cards.slice(i, i + 2).join('\n'));
  return `<!-- Generated by generate.mjs. Edit that file, not this one. -->
<div align="center">

<img src="assets/banner.svg" width="100%" alt="Pixel-art room with ${esc(d.name)}'s latest commits scrolling on the monitor">

<sub>The monitor scrolls my latest commits; the shelf holds a book for each language I write.</sub>

<br><br>

<img src="assets/about.svg" width="100%" alt="${esc(d.name)} · ${esc(PROGRAM)} · ${esc(UNIVERSITY)}">

<img src="assets/stats.svg" width="100%" alt="${d.stats.commits} commits, ${d.stats.prs} pull requests, ${d.stats.stars} stars, best streak ${d.stats.best} days">

<img src="assets/projects-heading.svg" width="100%" alt="Projects">

${rows.join('\n\n')}

<img src="assets/activity.svg" width="100%" alt="${d.stats.year} contributions in the past year">

</div>
`;
}

// ---------- main ----------

const data = await fetchData();
mkdirSync('assets', { recursive: true });
const out = {
  'assets/banner.svg': banner(data),
  'assets/about.svg': about(data),
  'assets/stats.svg': stats(data),
  'assets/projects-heading.svg': heading('PROJECTS'),
  'assets/activity.svg': activity(data),
  'README.md': readme(data),
};
data.projects.forEach((p, i) => { out[`assets/project-${i + 1}.svg`] = project(p); });
for (const [file, content] of Object.entries(out)) writeFileSync(file, content);
console.log(`Wrote ${Object.keys(out).length} files:`, data.stats, `${data.commits.length} commits on the monitor`);
