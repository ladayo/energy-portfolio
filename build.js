#!/usr/bin/env node
/*
 * Site builder — no dependencies, runs on Node 18+.
 * Netlify runs this automatically on every publish (see netlify.toml).
 *
 * Reads everything in /content and produces:
 *   data/site-data.json        — the content bundle the website reads
 *   posts/<slug>/index.html    — shareable link pages with social-preview tags
 *   sitemap.xml, feed.xml      — only when settings.siteUrl is filled in
 *
 * Options:
 *   --drafts            include posts marked as drafts (for local checking)
 *   --preview <file>    also write a single-file offline preview of the site
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const args = process.argv.slice(2);
const INCLUDE_DRAFTS = args.includes('--drafts');
const previewIdx = args.indexOf('--preview');
const PREVIEW_OUT = previewIdx > -1 ? args[previewIdx + 1] : null;

const warnings = [];
const warn = (m) => warnings.push(m);

function readJSON(rel) {
  const file = path.join(ROOT, rel);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`Could not read ${rel}: ${e.message}`);
  }
}

function readFolder(rel) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const item = readJSON(path.join(rel, f));
      item.slug = (item.slug || f.replace(/\.json$/, '')).toLowerCase();
      return item;
    });
}

function normDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function wordCount(s) {
  return String(s || '').split(/\s+/).filter(Boolean).length;
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function stripPlaceholders(s) {
  return String(s || '').replace(/\[\[(.+?)\]\]/g, '$1');
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

// ------------------------------------------------------------------ load
const settings = readJSON('content/settings.json');
const topics = readJSON('content/topics.json').topics || [];
const topicSlugs = new Set(topics.map((t) => t.slug));
const pages = {};
for (const name of ['home', 'about', 'guidelines', 'privacy', 'accessibility']) {
  pages[name] = readJSON(`content/pages/${name}.json`);
}
const resources = readJSON('content/resources.json');

const seen = new Set();
const posts = readFolder('content/posts')
  .filter((p) => {
    if (!p.title) { warn(`Post "${p.slug}" has no title and was skipped.`); return false; }
    if (!normDate(p.date)) { warn(`Post "${p.slug}" has no valid date (YYYY-MM-DD) and was skipped.`); return false; }
    if (p.draft && !INCLUDE_DRAFTS) return false;
    if (seen.has(p.slug)) { warn(`Duplicate post address "${p.slug}" — skipped the second one.`); return false; }
    seen.add(p.slug);
    return true;
  })
  .map((p) => {
    const categories = (p.categories || []).filter((c) => {
      if (!topicSlugs.has(c)) { warn(`Post "${p.slug}" uses unknown topic "${c}".`); return false; }
      return true;
    });
    const tags = (p.tags || []).map((t) => String(t).trim()).filter(Boolean);
    const comments = (p.comments || [])
      .filter((c) => c && c.text)
      .map((c) => ({ name: c.name || 'Reader', affiliation: c.affiliation || '', date: normDate(c.date), text: c.text }));
    return {
      slug: p.slug,
      title: p.title,
      date: normDate(p.date),
      updated: normDate(p.updated),
      type: p.type || 'Reflection',
      course: p.course || '',
      categories,
      tags,
      excerpt: p.excerpt || '',
      featured: !!p.featured,
      draft: !!p.draft,
      commentsOpen: p.commentsOpen !== false,
      readingMinutes: Math.max(1, Math.ceil(wordCount(p.body) / 200)),
      body: p.body || '',
      comments,
    };
  })
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)));

const projects = readFolder('content/projects')
  .filter((p) => p.title && !p.draft)
  .map((p) => ({
    slug: p.slug,
    title: p.title,
    type: p.type || 'Project',
    date: normDate(p.date),
    status: p.status || '',
    course: p.course || '',
    collaborators: p.collaborators || '',
    summary: p.summary || '',
    body: p.body || '',
    link: p.link || '',
    file: p.file || '',
    tags: (p.tags || []).filter(Boolean),
    categories: (p.categories || []).filter((c) => topicSlugs.has(c)),
  }))
  .sort((a, b) => (a.date < b.date ? 1 : -1));

const data = {
  builtAt: new Date().toISOString(),
  settings,
  topics,
  pages,
  posts,
  projects,
  resources,
};

// ------------------------------------------------------------------ write bundle
ensureDir(path.join(ROOT, 'data'));
fs.writeFileSync(path.join(ROOT, 'data', 'site-data.json'), JSON.stringify(data));

// ------------------------------------------------------------------ share pages
const siteUrl = String(settings.siteUrl || '').replace(/\/+$/, '');
const siteTitle = stripPlaceholders(settings.siteTitle || 'Learning Portfolio');
const postsDir = path.join(ROOT, 'posts');
fs.rmSync(postsDir, { recursive: true, force: true });
for (const p of posts) {
  const dir = path.join(postsDir, p.slug);
  ensureDir(dir);
  const target = `/#/post/${p.slug}`;
  const desc = stripPlaceholders(p.excerpt);
  const canonical = siteUrl ? `${siteUrl}/posts/${p.slug}/` : '';
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(p.title)} — ${escHtml(siteTitle)}</title>
<meta name="description" content="${escHtml(desc)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escHtml(p.title)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:site_name" content="${escHtml(siteTitle)}">
<meta property="article:published_time" content="${p.date}">
${canonical ? `<meta property="og:url" content="${escHtml(canonical)}">\n<link rel="canonical" href="${escHtml(canonical)}">` : ''}
<meta name="twitter:card" content="summary">
<meta http-equiv="refresh" content="0; url=${target}">
</head>
<body>
<p><a href="${target}">Continue to “${escHtml(p.title)}”</a></p>
</body>
</html>
`;
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

// ------------------------------------------------------------------ sitemap + feed
if (siteUrl) {
  const urls = ['/', ...posts.map((p) => `/posts/${p.slug}/`)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escHtml(siteUrl + u)}</loc></url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);

  const items = posts.slice(0, 20).map((p) => `    <item>
      <title>${escHtml(p.title)}</title>
      <link>${escHtml(`${siteUrl}/posts/${p.slug}/`)}</link>
      <guid>${escHtml(`${siteUrl}/posts/${p.slug}/`)}</guid>
      <pubDate>${new Date(p.date + 'T12:00:00Z').toUTCString()}</pubDate>
      <description>${escHtml(stripPlaceholders(p.excerpt))}</description>
    </item>`).join('\n');
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escHtml(siteTitle)}</title>
    <link>${escHtml(siteUrl)}/</link>
    <description>${escHtml(stripPlaceholders(settings.tagline || ''))}</description>
${items}
  </channel>
</rss>
`;
  fs.writeFileSync(path.join(ROOT, 'feed.xml'), feed);
} else {
  warn('Site address (siteUrl) is empty in Settings — sitemap and RSS feed were not generated.');
}

// ------------------------------------------------------------------ optional offline preview
if (PREVIEW_OUT) {
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'assets/js/app.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const shell = indexHtml.split('<!-- SHELL START -->')[1].split('<!-- SHELL END -->')[0];
  const safeJson = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const out = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(siteTitle)} — preview</title>
<meta name="description" content="${escHtml(stripPlaceholders(settings.tagline || ''))}">
<style>
${css}
</style>
</head>
<body>
${shell}
<script>window.__PREVIEW__ = true; window.__SITE_DATA__ = ${safeJson};</script>
<script>
${js}
</script>
</body>
</html>
`;
  fs.writeFileSync(path.resolve(PREVIEW_OUT), out);
  console.log(`Preview written to ${PREVIEW_OUT}`);
}

console.log(`Built ${posts.length} posts, ${projects.length} projects, ${resources.items ? resources.items.length : 0} resources.`);
if (warnings.length) {
  console.log('\nThings to check:');
  for (const w of warnings) console.log(' - ' + w);
}
