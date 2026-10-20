/*
 * Energy Security Learning Portfolio — site script.
 * You never need to edit this file to add or change content: everything the
 * site shows comes from the /content folder (edited through /admin).
 */
(function () {
  'use strict';

  var isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  var PREVIEW = isBrowser && !!window.__PREVIEW__;
  var D = null;                 // site data bundle
  var current = null;           // current route path
  var firstRender = true;
  // In-memory state (used by the offline preview to demonstrate moderation)
  var S = { pending: [], approved: {}, subscribers: [], messages: [], seq: 0 };

  var TYPES_ORDER = ['Reflection', 'Lesson', 'Course insight', 'Key takeaways', 'Assignment'];
  var RESOURCE_TYPES = ['Reports', 'Articles', 'Books', 'Tools & data', 'Links'];
  var PROJECT_TYPES = ['Research paper', 'Presentation', 'Case study', 'Group project', 'Sustainability initiative'];

  /* ------------------------------------------------------------ storage */
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };

  /* ------------------------------------------------------------ helpers */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Escape text and show [[placeholders]] as clearly labelled highlights
  function ph(s) {
    return esc(s).replace(/\[\[(.+?)\]\]/g, '<span class="placeholder"><span class="sr-only">Placeholder: </span>$1</span>');
  }
  function plain(s) { return String(s == null ? '' : s).replace(/\[\[(.+?)\]\]/g, '$1'); }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function hasText(s) { return !!String(s || '').trim(); }

  function safeUrl(u) {
    u = String(u || '').trim().replace(/&amp;/g, '&');
    if (/^(https?:|mailto:)/i.test(u) || /^#\//.test(u) || /^\/(?!\/)/.test(u)) return u;
    return '';
  }
  function isExternal(u) { return /^https?:/i.test(u); }

  function extLink(url, text, cls) {
    var u = safeUrl(url);
    if (!u) return text;
    if (isExternal(u)) {
      return '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + text +
        '<span class="sr-only"> (opens in a new tab)</span></a>';
    }
    return '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + esc(u) + '">' + text + '</a>';
  }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '';
    return MONTHS[parseInt(m[2], 10) - 1] + ' ' + parseInt(m[3], 10) + ', ' + m[1];
  }
  function timeTag(iso) { return iso ? '<time datetime="' + esc(iso) + '">' + fmtDate(iso) + '</time>' : ''; }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function tagHref(t) { return '#/tags/' + encodeURIComponent(String(t).toLowerCase()); }
  function topicBy(slug) { for (var i = 0; i < D.topics.length; i++) if (D.topics[i].slug === slug) return D.topics[i]; return null; }
  function postBy(slug) { for (var i = 0; i < D.posts.length; i++) if (D.posts[i].slug === slug) return D.posts[i]; return null; }
  function projectBy(slug) { for (var i = 0; i < D.projects.length; i++) if (D.projects[i].slug === slug) return D.projects[i]; return null; }
  function settings() { return D.settings || {}; }
  function siteTitle() { return plain(settings().siteTitle || 'Learning Portfolio'); }

  function parsePath(path) {
    path = String(path || '/');
    if (path.charAt(0) !== '/') path = '/' + path;
    var qi = path.indexOf('?');
    var pathname = qi > -1 ? path.slice(0, qi) : path;
    var query = {};
    if (qi > -1) {
      path.slice(qi + 1).split('&').forEach(function (pair) {
        if (!pair) return;
        var kv = pair.split('=');
        try { query[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' ')); } catch (e) { /* ignore */ }
      });
    }
    var parts = pathname.split('/').filter(Boolean).map(function (p) { try { return decodeURIComponent(p); } catch (e) { return p; } });
    return { pathname: pathname, parts: parts, query: query };
  }
  function qs(obj) {
    var out = [];
    Object.keys(obj).forEach(function (k) { if (obj[k] !== '' && obj[k] != null) out.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k])); });
    return out.length ? '?' + out.join('&') : '';
  }

  /* ------------------------------------------------------------ icons */
  var ICON_PATHS = {
    shield: '<path d="M12 3l7 3v5c0 4.6-3 8.6-7 10-4-1.4-7-5.4-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    arrow: '<path d="M3 12h15"/><path d="M13 6l6 6-6 6"/><path d="M3 6h5M3 18h5"/>',
    scales: '<path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7l-3 6a3 3 0 006 0L5 7zM19 7l-3 6a3 3 0 006 0l-3-6z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.4 2.7-6 6-6s6 2.6 6 6M15.5 14.3c3 .2 5.5 2.4 5.5 5.7"/>',
    triangle: '<path d="M12 4l8.5 15h-17z"/><circle cx="12" cy="4" r="1.6"/><circle cx="3.5" cy="19" r="1.6"/><circle cx="20.5" cy="19" r="1.6"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    display: '<path d="M4 7h10M4 17h6"/><circle cx="17" cy="7" r="3"/><circle cx="13" cy="17" r="3"/><path d="M20 17h-4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    leaf: '<path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19l7-7"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5H5V6h5"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>'
  };
  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICON_PATHS[name] || ICON_PATHS.leaf) + '</svg>';
  }
  function brandMark() {
    return '<svg class="brand-svg" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" focusable="false">' +
      '<rect width="40" height="40" rx="10" class="bm-bg"/>' +
      '<path class="bm-leaf" d="M10 29c0-11 7-18 21-19-1 13-8 20-19 20"/>' +
      '<path class="bm-bolt" d="M22 13l-6 9h5l-2 7 7-10h-5l1-6z"/></svg>';
  }

  /* ------------------------------------------------------------ markdown (safe subset) */
  var ESCAPED = { '*': '&#42;', '_': '&#95;', '[': '&#91;', ']': '&#93;', '(': '&#40;', ')': '&#41;', '#': '&#35;', '`': '&#96;', '\\': '&#92;', '-': '&#45;', '+': '&#43;' };
  function inline(s) {
    // backslash-escaped characters written by the content editor
    s = s.replace(/\\([\\`*_{}\[\]()#+\-.!])/g, function (m, c) { return ESCAPED[c] || c; });
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\[\[(.+?)\]\]/g, '<span class="placeholder"><span class="sr-only">Placeholder: </span>$1</span>');
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, alt, url) {
      var u = safeUrl(url);
      return u && !/^mailto:/i.test(u) ? '<img src="' + esc(u) + '" alt="' + alt + '" loading="lazy">' : '';
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, text, url) {
      var u = safeUrl(url);
      return u ? extLink(u, text) : text;
    });
    s = s.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, function (m, url) { return extLink(url, url); });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, '$1<em>$2</em>');
    return s;
  }
  function blocks(lines) {
    var out = [], para = [], i = 0, m;
    function flush() { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } }
    while (i < lines.length) {
      var l = lines[i];
      if (/^\s*$/.test(l)) { flush(); i++; continue; }
      if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) {
        flush();
        var lvl = Math.max(2, m[1].length);
        out.push('<h' + lvl + ' id="sec-' + slugify(plain(m[2])) + '">' + inline(m[2]) + '</h' + lvl + '>');
        i++; continue;
      }
      if (/^(-{3,}|\*{3,})\s*$/.test(l)) { flush(); out.push('<hr>'); i++; continue; }
      if (/^&gt;\s?/.test(l)) {
        flush();
        var q = [];
        while (i < lines.length && /^&gt;\s?/.test(lines[i])) { q.push(lines[i].replace(/^&gt;\s?/, '')); i++; }
        out.push('<blockquote>' + blocks(q) + '</blockquote>');
        continue;
      }
      if (/^\s*[-*+]\s+/.test(l)) {
        flush();
        var ul = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { ul.push('<li>' + inline(lines[i].replace(/^\s*[-*+]\s+/, '')) + '</li>'); i++; }
        out.push('<ul>' + ul.join('') + '</ul>');
        continue;
      }
      if (/^\s*\d+[.)]\s+/.test(l)) {
        flush();
        var ol = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { ol.push('<li>' + inline(lines[i].replace(/^\s*\d+[.)]\s+/, '')) + '</li>'); i++; }
        out.push('<ol>' + ol.join('') + '</ol>');
        continue;
      }
      para.push(l.trim());
      i++;
    }
    flush();
    return out.join('\n');
  }
  function md(src) { return blocks(esc(src || '').replace(/\r\n?/g, '\n').split('\n')); }

  /* ------------------------------------------------------------ shared fragments */
  function photo() {
    var s = settings();
    if (hasText(s.photo)) {
      return '<img class="portrait-img" src="' + esc(s.photo) + '" alt="' + esc(plain(s.photoAlt || 'Portrait')) + '" width="480" height="560">';
    }
    return '<div class="portrait-placeholder" role="img" aria-label="Photo placeholder — replace with a professional photograph">' +
      '<svg viewBox="0 0 120 140" width="120" height="140" aria-hidden="true" focusable="false"><circle cx="60" cy="52" r="26"/><path d="M14 136c4-30 22-46 46-46s42 16 46 46"/></svg>' +
      '<span class="pp-title">Your professional photo</span>' +
      '<span class="pp-hint">Placeholder — add it in the content editor under Settings → Photo</span></div>';
  }

  function topicChips(slugs, small) {
    if (!slugs || !slugs.length) return '';
    return '<ul class="topic-chips' + (small ? ' small' : '') + '" aria-label="Topics">' + slugs.map(function (s) {
      var t = topicBy(s);
      return t ? '<li><a class="topic-chip" href="#/topics/' + esc(t.slug) + '">' + esc(t.name) + '</a></li>' : '';
    }).join('') + '</ul>';
  }
  function tagList(tags, label) {
    if (!tags || !tags.length) return '';
    return '<ul class="tag-list" aria-label="' + esc(label || 'Tags') + '">' + tags.map(function (t) {
      return '<li><a class="tag" href="' + tagHref(t) + '">#' + esc(t) + '</a></li>';
    }).join('') + '</ul>';
  }

  function postCard(p, headingLevel) {
    var h = headingLevel || 3;
    var t = topicBy(p.categories[0]);
    return '<article class="card post-card">' +
      '<p class="card-eyebrow">' + (t ? esc(t.name) : 'Journal') + ' · ' + esc(p.type) + '</p>' +
      '<h' + h + ' class="card-title"><a href="#/post/' + esc(p.slug) + '">' + ph(p.title) + '</a></h' + h + '>' +
      '<p class="card-meta">' + timeTag(p.date) + ' · ' + p.readingMinutes + ' min read</p>' +
      '<p class="card-excerpt">' + ph(p.excerpt) + '</p>' +
      tagList(p.tags.slice(0, 3), 'Tags for ' + plain(p.title)) +
      '</article>';
  }

  function projectCard(p, headingLevel) {
    var h = headingLevel || 3;
    return '<article class="card project-card">' +
      '<p class="card-eyebrow"><span class="badge">' + esc(p.type) + '</span>' + (p.status ? ' <span class="status">' + esc(p.status) + '</span>' : '') + '</p>' +
      '<h' + h + ' class="card-title"><a href="#/project/' + esc(p.slug) + '">' + ph(p.title) + '</a></h' + h + '>' +
      (p.date ? '<p class="card-meta">' + (p.status === 'Completed' ? 'Completed ' : 'Target date: ') + timeTag(p.date) + '</p>' : '') +
      '<p class="card-excerpt">' + ph(p.summary) + '</p>' +
      '</article>';
  }

  function pageHeader(eyebrow, title, intro) {
    return '<header class="page-header"><div class="container">' +
      (eyebrow ? '<p class="eyebrow">' + eyebrow + '</p>' : '') +
      '<h1 tabindex="-1">' + title + '</h1>' +
      (intro ? '<p class="page-intro">' + intro + '</p>' : '') +
      '</div></header>';
  }

  /* ------------------------------------------------------------ form fragments */
  function field(o) {
    // o: {id, name, label, type, required, hint, autocomplete, min, max, options, rows, value}
    var desc = [];
    if (o.hint) desc.push(o.id + '-hint');
    desc.push(o.id + '-err');
    var common = ' id="' + o.id + '" name="' + o.name + '"' + (o.required ? ' required aria-required="true"' : '') +
      ' aria-describedby="' + desc.join(' ') + '" data-label="' + esc(o.short || o.label) + '"' +
      (o.min ? ' minlength="' + o.min + '"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '') +
      (o.autocomplete ? ' autocomplete="' + o.autocomplete + '"' : '');
    var control;
    if (o.type === 'textarea') {
      control = '<textarea' + common + ' rows="' + (o.rows || 6) + '"></textarea>';
    } else if (o.type === 'select') {
      control = '<select' + common + '><option value="">Choose one…</option>' + o.options.map(function (op) { return '<option>' + esc(op) + '</option>'; }).join('') + '</select>';
    } else if (o.type === 'checkbox') {
      return '<div class="field field-check"><input type="checkbox"' + common + ' value="yes">' +
        '<label for="' + o.id + '">' + o.label + (o.required ? '' : ' <span class="optional">(optional)</span>') + '</label>' +
        '<p class="field-error" id="' + o.id + '-err" hidden></p></div>';
    } else {
      control = '<input type="' + (o.type || 'text') + '"' + common + (o.type === 'email' ? ' inputmode="email" spellcheck="false"' : '') + '>';
    }
    return '<div class="field"><label for="' + o.id + '">' + esc(o.label) + (o.required ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="optional">(optional)</span>') + '</label>' +
      (o.hint ? '<p class="field-hint" id="' + o.id + '-hint">' + o.hint + '</p>' : '') +
      control + '<p class="field-error" id="' + o.id + '-err" hidden></p>' +
      (o.counter ? '<p class="counter" id="' + o.id + '-count" data-counter-for="' + o.id + '">0 / ' + o.max + ' characters</p>' : '') +
      '</div>';
  }
  function honeypot(prefix) {
    return '<div class="hp" aria-hidden="true"><label for="' + prefix + '-bf">Leave this field empty</label>' +
      '<input id="' + prefix + '-bf" name="bot-field" tabindex="-1" autocomplete="off"></div>';
  }
  function formShell(kind, prefix, inner, extraAttrs) {
    return '<form class="form" data-form="' + kind + '" data-prefix="' + prefix + '" novalidate' + (extraAttrs || '') + '>' +
      '<div class="error-summary" id="' + prefix + '-summary" role="alert" tabindex="-1" hidden></div>' +
      inner + honeypot(prefix) +
      '<div class="form-status" id="' + prefix + '-status" role="status" aria-live="polite"></div>' +
      '</form>';
  }

  function subscribeForm(prefix, compact) {
    var s = settings().subscribe || {};
    var intro = '<p class="subscribe-copy">Get new posts by email — roughly ' + ph('[[once or twice a month]]') + '. No spam, unsubscribe any time.</p>';
    var consent = 'I agree to receive email updates and have read the <a href="#/privacy">privacy notice</a>.';
    if (s.provider === 'buttondown' && hasText(s.buttondownUsername) && !PREVIEW) {
      return intro + '<form class="form subscribe-form' + (compact ? ' compact' : '') + '" action="https://buttondown.com/api/emails/embed-subscribe/' + esc(encodeURIComponent(s.buttondownUsername)) + '" method="post" target="_blank">' +
        '<div class="field"><label for="' + prefix + '-email">Email address</label><input type="email" id="' + prefix + '-email" name="email" required autocomplete="email"></div>' +
        '<button class="btn btn-primary" type="submit">Subscribe</button>' +
        '<p class="field-hint">You\'ll get a confirmation email first (double opt-in). Opens in a new tab.</p></form>';
    }
    return intro + formShell('subscribe', prefix,
      '<div class="subscribe-row">' +
      field({ id: prefix + '-email', name: 'email', label: 'Email address', type: 'email', required: true, autocomplete: 'email' }) +
      '<button class="btn btn-primary" type="submit">Subscribe</button></div>' +
      field({ id: prefix + '-consent', name: 'consent', label: consent, short: 'Consent', type: 'checkbox', required: true }),
      ' data-compact="' + (compact ? '1' : '0') + '"');
  }

  /* ------------------------------------------------------------ header & footer */
  var NAV = [
    { href: '#/', label: 'Home', key: '' },
    { href: '#/about', label: 'About me', key: 'about' },
    { href: '#/journal', label: 'Learning journal', key: 'journal', also: ['post', 'tags'] },
    { href: '#/research', label: 'Research & projects', key: 'research', also: ['project'] },
    { href: '#/topics', label: 'Topics', key: 'topics' },
    { href: '#/resources', label: 'Resources', key: 'resources' },
    { href: '#/contact', label: 'Contact', key: 'contact' }
  ];

  function headerHtml() {
    var s = settings();
    return '<header class="site-header">' +
      '<div class="container header-inner">' +
      '<a class="brand" href="#/">' + brandMark() + '<span class="brand-text"><span class="brand-title">' + esc(siteTitle()) + '</span>' +
      '<span class="brand-sub">by ' + ph(s.ownerName || '') + '</span></span></a>' +
      '<div class="header-tools">' +
      '<button class="icon-btn" type="button" data-action="toggle-search" aria-expanded="false" aria-controls="header-search">' + icon('search') + '<span class="sr-only">Search the site</span></button>' +
      '<button class="icon-btn" type="button" data-action="toggle-display" aria-expanded="false" aria-controls="display-panel">' + icon('display') + '<span class="sr-only">Display and accessibility options</span></button>' +
      '<button class="icon-btn menu-btn" type="button" data-action="toggle-menu" aria-expanded="false" aria-controls="primary-nav">' + icon('menu', 'i-open') + icon('close', 'i-close') + '<span class="menu-label">Menu</span></button>' +
      '</div>' +
      '<nav id="primary-nav" class="primary-nav" aria-label="Main"><ul>' +
      NAV.map(function (n) { return '<li><a href="' + n.href + '" data-nav="' + n.key + '">' + n.label + '</a></li>'; }).join('') +
      '</ul></nav>' +
      '</div>' +
      '<div id="header-search" class="drawer" hidden><div class="container">' +
      '<form class="search-form" role="search" data-form="search" aria-label="Site search">' +
      '<label for="hs-q" class="sr-only">Search posts, projects and resources</label>' +
      '<input id="hs-q" name="q" type="search" placeholder="Search posts, projects and resources" autocomplete="off">' +
      '<button class="btn btn-primary" type="submit">Search</button></form></div></div>' +
      '<div id="display-panel" class="drawer" hidden><div class="container display-panel">' +
      '<div class="display-group" role="group" aria-labelledby="dp-text"><p id="dp-text" class="dp-label">Text size</p>' +
      [['base', 'Standard'], ['lg', 'Large'], ['xl', 'Extra large']].map(function (o) {
        return '<button type="button" class="chip-btn" data-action="text-size" data-value="' + o[0] + '" aria-pressed="false">' + o[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="display-group" role="group" aria-labelledby="dp-theme"><p id="dp-theme" class="dp-label">Colour theme</p>' +
      [['auto', 'Match my device'], ['light', 'Light'], ['dark', 'Dark'], ['contrast', 'High contrast']].map(function (o) {
        return '<button type="button" class="chip-btn" data-action="theme" data-value="' + o[0] + '" aria-pressed="false">' + o[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="display-group" role="group" aria-labelledby="dp-read"><p id="dp-read" class="dp-label">Reading</p>' +
      '<button type="button" class="chip-btn" data-action="spacing" aria-pressed="false">Extra line spacing</button>' +
      '<button type="button" class="chip-btn" data-action="underline" aria-pressed="false">Underline all links</button></div>' +
      '<p class="dp-note">Your choices are remembered on this device. See the <a href="#/accessibility">accessibility statement</a>.</p>' +
      '</div></div>' +
      '</header>';
  }

  function socialLinks(cls) {
    var s = settings().social || {};
    var map = [['linkedin', 'LinkedIn'], ['orcid', 'ORCID'], ['researchgate', 'ResearchGate'], ['googleScholar', 'Google Scholar'], ['github', 'GitHub'], ['bluesky', 'Bluesky']];
    var items = map.filter(function (m) { return hasText(s[m[0]]) && safeUrl(s[m[0]]); }).map(function (m) {
      return '<li>' + extLink(s[m[0]], icon('external') + '<span>' + m[1] + '</span>', 'social-link') + '</li>';
    });
    if (!items.length) return '';
    return '<ul class="' + (cls || 'social-list') + '">' + items.join('') + '</ul>';
  }

  function footerHtml() {
    var s = settings();
    var year = new Date().getFullYear();
    return '<footer class="site-footer"><div class="container footer-grid">' +
      '<div class="footer-about"><a class="brand brand-footer" href="#/">' + brandMark() + '<span class="brand-text"><span class="brand-title">' + esc(siteTitle()) + '</span></span></a>' +
      '<p>' + ph(s.tagline) + '</p><p class="muted">' + esc(s.programme || '') + '<br>' + esc(s.university || '') + '</p>' + socialLinks('social-list footer-social') + '</div>' +
      '<nav class="footer-nav" aria-label="Footer"><h2 class="footer-h">Explore</h2><ul>' +
      NAV.map(function (n) { return '<li><a href="' + n.href + '">' + n.label + '</a></li>'; }).join('') + '<li><a href="#/search">Search</a></li></ul></nav>' +
      '<div class="footer-nav"><h2 class="footer-h">About this site</h2><ul>' +
      '<li><a href="#/guidelines">Community guidelines</a></li><li><a href="#/privacy">Privacy notice</a></li><li><a href="#/accessibility">Accessibility</a></li>' +
      (hasText(s.siteUrl) && !PREVIEW ? '<li><a href="/feed.xml">RSS feed</a></li>' : '') +
      (PREVIEW ? '<li><a href="#/moderation-demo">Moderation demo (preview only)</a></li>' : '') +
      '</ul></div>' +
      '<div class="footer-subscribe"><h2 class="footer-h">Email updates</h2>' + subscribeForm('fs', true) + '</div>' +
      '</div><div class="container footer-bottom"><p>© ' + year + ' ' + ph(s.ownerName) + '. Writing licensed under ' + ph(s.licence) + '. Views are my own and do not represent the University of Saskatchewan.</p></div></footer>';
  }

  /* ------------------------------------------------------------ views */
  function viewHome() {
    var h = D.pages.home, s = settings();
    var latest = D.posts.slice(0, 3);
    var featured = D.projects.slice(0, 2);
    var html = '<section class="hero" aria-labelledby="hero-h"><div class="container hero-grid">' +
      '<div class="hero-text"><p class="eyebrow">' + ph(h.heroEyebrow) + '</p>' +
      '<h1 id="hero-h" tabindex="-1">' + ph(h.heroHeading) + '</h1>' +
      '<div class="lead">' + md(h.heroIntro) + '</div>' +
      '<div class="btn-row"><a class="btn btn-primary" href="#/journal">Read the learning journal</a><a class="btn btn-ghost" href="#/about">About me</a></div></div>' +
      '<figure class="portrait">' + photo() + '<figcaption>' + ph(s.ownerName) + ' · ' + esc(s.programme || '') + '</figcaption></figure>' +
      '</div></section>' +
      '<section class="section" aria-labelledby="int-h"><div class="container">' +
      '<h2 id="int-h" class="section-title">' + ph(h.interestsHeading) + '</h2>' +
      '<ul class="interest-list">' + (h.interests || []).map(function (i) { return '<li>' + icon('leaf') + '<span>' + ph(i) + '</span></li>'; }).join('') + '</ul>' +
      '</div></section>' +
      '<section class="section section-tint" aria-labelledby="latest-h"><div class="container">' +
      '<div class="section-head"><h2 id="latest-h" class="section-title">Latest from the journal</h2><a class="more-link" href="#/journal">All posts <span aria-hidden="true">→</span></a></div>' +
      '<div class="card-grid">' + latest.map(function (p) { return postCard(p, 3); }).join('') + '</div>' +
      '</div></section>' +
      '<section class="section" aria-labelledby="topics-h"><div class="container">' +
      '<div class="section-head"><h2 id="topics-h" class="section-title">Explore by topic</h2><a class="more-link" href="#/topics">All topics <span aria-hidden="true">→</span></a></div>' +
      '<ul class="topic-grid compact">' + D.topics.map(topicTile).join('') + '</ul></div></section>' +
      (featured.length ? '<section class="section section-tint" aria-labelledby="proj-h"><div class="container">' +
        '<div class="section-head"><h2 id="proj-h" class="section-title">Research and projects</h2><a class="more-link" href="#/research">See all <span aria-hidden="true">→</span></a></div>' +
        '<div class="card-grid two">' + featured.map(function (p) { return projectCard(p, 3); }).join('') + '</div></div></section>' : '') +
      '<section class="section" aria-labelledby="sub-h"><div class="container"><div class="subscribe-band">' +
      '<div><h2 id="sub-h" class="section-title">Follow along</h2><p>' + ph(h.invitation) + '</p></div>' +
      '<div>' + subscribeForm('hs', false) + '</div></div></div></section>';
    return { title: 'Home', html: html };
  }

  function topicTile(t) {
    var n = D.posts.filter(function (p) { return p.categories.indexOf(t.slug) > -1; }).length;
    return '<li class="topic-tile"><a href="#/topics/' + esc(t.slug) + '">' + icon(t.icon, 'topic-icon') +
      '<span class="tt-name">' + esc(t.name) + '</span><span class="tt-count">' + n + (n === 1 ? ' post' : ' posts') + '</span></a></li>';
  }

  function viewAbout() {
    var a = D.pages.about, s = settings();
    var html = pageHeader('About me', 'About me', ph(a.lead)) +
      '<div class="container about-grid">' +
      '<div class="prose">' + md(a.body) + '</div>' +
      '<aside class="about-aside" aria-label="Profile summary">' +
      '<figure class="portrait small">' + photo() + '</figure>' +
      '<div class="aside-card"><h2 class="aside-h">Education</h2><ul class="edu-list">' + (a.education || []).map(function (e) {
        return '<li><strong>' + ph(e.title) + '</strong><span>' + ph(e.place) + '</span><span class="muted">' + ph(e.years) + '</span></li>';
      }).join('') + '</ul></div>' +
      '<div class="aside-card"><h2 class="aside-h">Areas of interest</h2><ul class="topic-chips plain">' + (a.interests || []).map(function (i) { return '<li><span class="topic-chip static">' + ph(i) + '</span></li>'; }).join('') + '</ul></div>' +
      '<div class="aside-card"><h2 class="aside-h">Connect</h2>' + (socialLinks() || '<p class="muted">' + ph('[[Add your LinkedIn or other professional profiles in Settings → Social links]]') + '</p>') +
      (hasText(a.cvLink) ? '<p>' + extLink(a.cvLink, icon('file') + ' Download my CV', 'btn btn-ghost') + '</p>' : '<p class="muted">' + ph('[[Optional: upload a CV and add the link in About → CV link]]') + '</p>') +
      '<p><a class="btn btn-primary" href="#/contact">Get in touch</a></p></div>' +
      '</aside></div>';
    return { title: 'About me', html: html };
  }

  function viewJournal(q) {
    var per = parseInt(settings().postsPerPage, 10) || 8;
    var types = TYPES_ORDER.filter(function (t) { return D.posts.some(function (p) { return p.type === t; }); });
    D.posts.forEach(function (p) { if (types.indexOf(p.type) < 0) types.push(p.type); });
    var list = D.posts.filter(function (p) {
      return (!q.type || p.type === q.type) && (!q.topic || p.categories.indexOf(q.topic) > -1);
    });
    if (q.sort === 'oldest') list = list.slice().reverse();
    var page = Math.max(1, parseInt(q.page, 10) || 1);
    var pages = Math.max(1, Math.ceil(list.length / per));
    if (page > pages) page = pages;
    var shown = list.slice((page - 1) * per, page * per);
    var filtered = !!(q.type || q.topic || q.sort);

    var html = pageHeader('Learning journal', 'Learning journal',
      'Reflections, lessons, assignments, course insights and key takeaways from the programme — written as I go.') +
      '<div class="container">' +
      '<form class="filter-bar" data-form="journal-filter" aria-label="Filter posts">' +
      '<div class="field inline"><label for="jf-type">Entry type</label><select id="jf-type" name="type"><option value="">All types</option>' +
      types.map(function (t) { return '<option' + (q.type === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field inline"><label for="jf-topic">Topic</label><select id="jf-topic" name="topic"><option value="">All topics</option>' +
      D.topics.map(function (t) { return '<option value="' + esc(t.slug) + '"' + (q.topic === t.slug ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field inline"><label for="jf-sort">Order</label><select id="jf-sort" name="sort"><option value="">Newest first</option><option value="oldest"' + (q.sort === 'oldest' ? ' selected' : '') + '>Oldest first</option></select></div>' +
      '<div class="filter-actions"><button class="btn btn-primary" type="submit">Apply filters</button>' + (filtered ? '<a class="btn btn-link" href="#/journal">Clear filters</a>' : '') + '</div>' +
      '</form>' +
      '<p class="result-count" role="status">' + (list.length ? 'Showing ' + shown.length + ' of ' + list.length + (list.length === 1 ? ' post' : ' posts') : 'No posts match these filters yet.') + '</p>' +
      '<div class="post-list">' + shown.map(function (p) { return postCard(p, 2); }).join('') + '</div>';
    if (pages > 1) {
      var base = { type: q.type || '', topic: q.topic || '', sort: q.sort || '' };
      html += '<nav class="pagination" aria-label="Journal pages">' +
        (page > 1 ? '<a class="btn btn-ghost" href="#/journal' + qs(Object.assign({}, base, { page: page - 1 })) + '">← Newer posts</a>' : '<span></span>') +
        '<span class="muted">Page ' + page + ' of ' + pages + '</span>' +
        (page < pages ? '<a class="btn btn-ghost" href="#/journal' + qs(Object.assign({}, base, { page: page + 1 })) + '">Older posts →</a>' : '<span></span>') +
        '</nav>';
    }
    html += '</div>';
    return { title: 'Learning journal', html: html };
  }

  function relatedPosts(p) {
    return D.posts.filter(function (o) { return o.slug !== p.slug; }).map(function (o) {
      var score = 0;
      o.categories.forEach(function (c) { if (p.categories.indexOf(c) > -1) score += 3; });
      o.tags.forEach(function (t) { if (p.tags.map(function (x) { return x.toLowerCase(); }).indexOf(t.toLowerCase()) > -1) score += 2; });
      return { p: o, score: score };
    }).sort(function (a, b) { return b.score - a.score || (a.p.date < b.p.date ? 1 : -1); }).slice(0, 3).map(function (x) { return x.p; });
  }

  function shareUrl(p) {
    var s = settings();
    if (hasText(s.siteUrl)) return String(s.siteUrl).replace(/\/+$/, '') + '/posts/' + p.slug + '/';
    if (!isBrowser) return '#/post/' + p.slug;
    return String(window.location.href).split('#')[0] + '#/post/' + p.slug;
  }

  function shareBlock(p) {
    var url = shareUrl(p), u = encodeURIComponent(url), t = encodeURIComponent(plain(p.title));
    var links = [
      ['LinkedIn', 'https://www.linkedin.com/sharing/share-offsite/?url=' + u],
      ['X', 'https://twitter.com/intent/tweet?url=' + u + '&text=' + t],
      ['Bluesky', 'https://bsky.app/intent/compose?text=' + t + '%20' + u],
      ['Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + u]
    ];
    return '<section class="share" aria-labelledby="share-h"><h2 id="share-h" class="h-small">Share this post</h2><ul class="share-list">' +
      links.map(function (l) {
        return '<li><a class="share-btn" href="' + esc(l[1]) + '" target="_blank" rel="noopener noreferrer">' + l[0] + '<span class="sr-only"> (share in a new tab)</span></a></li>';
      }).join('') +
      '<li><a class="share-btn" href="' + esc('mailto:?subject=' + t + '&body=' + encodeURIComponent(plain(p.title) + ' — ' + url)) + '">' + icon('mail') + 'Email</a></li>' +
      '<li><button type="button" class="share-btn" data-action="copy-link" data-url="' + esc(url) + '">' + icon('link') + 'Copy link</button></li>' +
      '</ul><p class="copy-status" role="status" aria-live="polite"></p></section>';
  }

  function commentList(p) {
    var items = (p.comments || []).concat(S.approved[p.slug] || []);
    if (!items.length) return '<p class="muted">No comments yet. Be the first to share a thought.</p>';
    return '<ol class="comment-list">' + items.map(function (c) {
      return '<li class="comment"><article aria-label="Comment by ' + esc(plain(c.name)) + '"><header class="comment-head">' +
        '<span class="avatar" aria-hidden="true">' + esc(plain(c.name).charAt(0).toUpperCase() || '?') + '</span>' +
        '<span><strong>' + ph(c.name) + '</strong>' + (c.affiliation ? '<span class="muted"> · ' + ph(c.affiliation) + '</span>' : '') +
        (c.date ? '<br><span class="muted small">' + timeTag(c.date) + '</span>' : '') + '</span></header>' +
        '<div class="comment-body">' + md(c.text) + '</div></article></li>';
    }).join('') + '</ol>';
  }

  function commentsSection(p) {
    var cfg = settings().comments || {};
    var provider = cfg.provider || 'moderated';
    var g = cfg.giscus || {};
    var count = (p.comments || []).length + (S.approved[p.slug] || []).length;
    var html = '<section class="comments" id="comments" aria-labelledby="comments-h"><div class="container narrow">' +
      '<h2 id="comments-h">Discussion' + (provider === 'moderated' ? ' <span class="count">(' + count + ')</span>' : '') + '</h2>';
    if (provider === 'off') return html + '<p class="muted">Comments are turned off on this site.</p></div></section>';
    if (provider === 'giscus' && !PREVIEW) {
      if (hasText(g.repo) && hasText(g.repoId) && hasText(g.categoryId)) {
        return html + '<p class="comment-note">Comments use GitHub sign-in, so every commenter is a verified account. Please read the <a href="#/guidelines">community guidelines</a> before posting.</p>' +
          '<div id="giscus-thread" class="giscus-wrap" data-slug="' + esc(p.slug) + '"></div></div></section>';
      }
      return html + '<p class="placeholder-box">' + ph('[[Comments are set to GitHub sign-in but are not configured yet. Add your Giscus details in Settings → Comments.]]') + '</p></div></section>';
    }
    html += commentList(p);
    var pending = S.pending.filter(function (c) { return c.slug === p.slug; });
    if (pending.length) {
      html += '<p class="pending-note">' + pending.length + (pending.length === 1 ? ' comment is' : ' comments are') + ' awaiting moderation.' +
        (PREVIEW ? ' <a href="#/moderation-demo">Open the moderation demo</a> to approve or remove ' + (pending.length === 1 ? 'it' : 'them') + '.' : '') + '</p>';
    }
    if (!p.commentsOpen) return html + '<p class="muted">Comments are closed on this post.</p></div></section>';
    html += '<div class="comment-form-wrap"><h3>Leave a comment</h3>' +
      '<p class="comment-note">Comments are reviewed before they appear, to keep the discussion constructive and spam-free. Your email address is used only to verify your comment and is never published. Please read the <a href="#/guidelines">community guidelines</a>.</p>' +
      formShell('comment', 'cm',
        '<div class="field-row">' +
        field({ id: 'cm-name', name: 'name', label: 'Name', required: true, autocomplete: 'name', min: 2, max: 80 }) +
        field({ id: 'cm-email', name: 'email', label: 'Email (not published)', type: 'email', required: true, autocomplete: 'email' }) +
        '</div>' +
        field({ id: 'cm-aff', name: 'affiliation', label: 'Affiliation or role', hint: 'For example: "MSc student, University of Saskatchewan" or "Energy analyst".', max: 100, autocomplete: 'organization' }) +
        field({ id: 'cm-text', name: 'comment', label: 'Your comment', type: 'textarea', required: true, min: 10, max: 2000, rows: 6, counter: true, hint: 'Plain text. You can use **bold**, *italics* and links.' }) +
        field({ id: 'cm-agree', name: 'agree', label: 'I have read and agree to follow the <a href="#/guidelines">community guidelines</a>.', short: 'Community guidelines', type: 'checkbox', required: true }) +
        '<input type="hidden" name="post-slug" value="' + esc(p.slug) + '"><input type="hidden" name="post-title" value="' + esc(plain(p.title)) + '">' +
        '<button class="btn btn-primary" type="submit">Submit comment for review</button>',
        ' data-slug="' + esc(p.slug) + '"') +
      '</div></div></section>';
    return html;
  }

  function commentLabel(p) {
    var n = (p.comments || []).length + (S.approved[p.slug] || []).length;
    return n === 0 ? 'Join the discussion' : n === 1 ? '1 comment' : n + ' comments';
  }

  function viewPost(slug) {
    var p = postBy(slug);
    if (!p) return viewNotFound();
    var idx = D.posts.indexOf(p);
    var newer = D.posts[idx - 1], older = D.posts[idx + 1];
    var s = settings();
    var rel = relatedPosts(p);
    var html = '<article class="post" aria-labelledby="post-title">' +
      '<header class="post-header"><div class="container narrow">' +
      '<nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="#/">Home</a></li><li><a href="#/journal">Learning journal</a></li><li aria-current="page">' + ph(p.title) + '</li></ol></nav>' +
      '<p class="eyebrow">' + esc(p.type) + (p.course ? ' · ' + ph(p.course) : '') + '</p>' +
      '<h1 id="post-title" tabindex="-1">' + ph(p.title) + '</h1>' +
      '<p class="post-meta">Published ' + timeTag(p.date) + (p.updated ? ' · Updated ' + timeTag(p.updated) : '') + ' · ' + p.readingMinutes + ' min read' +
      ' · <a href="#/post/' + esc(p.slug) + '" data-scroll="comments">' + commentLabel(p) + '</a></p>' +
      topicChips(p.categories) +
      '</div></header>' +
      '<div class="container narrow"><p class="post-excerpt">' + ph(p.excerpt) + '</p><div class="prose">' + md(p.body) + '</div>' +
      '<footer class="post-footer">' +
      (p.tags.length ? '<div class="tags-row"><h2 class="h-small">Tags</h2>' + tagList(p.tags) + '</div>' : '') +
      shareBlock(p) +
      '<div class="author-box">' + '<span class="avatar lg" aria-hidden="true">' + icon('leaf') + '</span><div><p class="h-small">Written by ' + ph(s.ownerName) + '</p>' +
      '<p>' + esc(s.programme || '') + ', ' + esc(s.university || '') + '. <a href="#/about">More about me</a> · <a href="#/contact">Get in touch</a></p></div></div>' +
      '<nav class="post-nav" aria-label="More posts">' +
      (older ? '<a class="pn-link" href="#/post/' + esc(older.slug) + '"><span class="muted small">← Previous post</span><span>' + ph(older.title) + '</span></a>' : '<span></span>') +
      (newer ? '<a class="pn-link next" href="#/post/' + esc(newer.slug) + '"><span class="muted small">Next post →</span><span>' + ph(newer.title) + '</span></a>' : '<span></span>') +
      '</nav></footer></div></article>' +
      (rel.length ? '<section class="section section-tint" aria-labelledby="rel-h"><div class="container"><h2 id="rel-h" class="section-title">Related posts</h2><div class="card-grid">' +
        rel.map(function (r) { return postCard(r, 3); }).join('') + '</div></div></section>' : '') +
      commentsSection(p);
    return { title: plain(p.title), html: html, post: p };
  }

  function viewResearch(q) {
    var types = PROJECT_TYPES.slice();
    D.projects.forEach(function (p) { if (types.indexOf(p.type) < 0) types.push(p.type); });
    var list = D.projects.filter(function (p) { return !q.type || p.type === q.type; });
    var html = pageHeader('Research & projects', 'Research and projects',
      'Research papers, presentations, case studies, group projects and sustainability initiatives from the programme.') +
      '<div class="container">' +
      '<nav class="filter-tabs" aria-label="Filter by project type"><ul>' +
      '<li><a href="#/research"' + (!q.type ? ' aria-current="page"' : '') + '>All</a></li>' +
      types.map(function (t) { return '<li><a href="#/research' + qs({ type: t }) + '"' + (q.type === t ? ' aria-current="page"' : '') + '>' + esc(t) + '</a></li>'; }).join('') +
      '</ul></nav>' +
      '<p class="result-count" role="status">' + (list.length ? list.length + (list.length === 1 ? ' item' : ' items') : 'Nothing here yet — check back soon.') + '</p>' +
      '<div class="card-grid">' + list.map(function (p) { return projectCard(p, 2); }).join('') + '</div></div>';
    return { title: 'Research and projects', html: html };
  }

  function viewProject(slug) {
    var p = projectBy(slug);
    if (!p) return viewNotFound();
    var actions = [];
    if (hasText(p.link) && safeUrl(p.link)) actions.push(extLink(p.link, icon('external') + ' View online', 'btn btn-primary'));
    if (hasText(p.file) && safeUrl(p.file)) actions.push(extLink(p.file, icon('file') + ' Download file', 'btn btn-ghost'));
    var html = '<article class="post" aria-labelledby="proj-title"><header class="post-header"><div class="container narrow">' +
      '<nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="#/">Home</a></li><li><a href="#/research">Research &amp; projects</a></li><li aria-current="page">' + ph(p.title) + '</li></ol></nav>' +
      '<p class="eyebrow"><span class="badge">' + esc(p.type) + '</span>' + (p.status ? ' <span class="status">' + esc(p.status) + '</span>' : '') + '</p>' +
      '<h1 id="proj-title" tabindex="-1">' + ph(p.title) + '</h1>' +
      '<dl class="facts">' +
      (p.date ? '<div><dt>Date</dt><dd>' + timeTag(p.date) + '</dd></div>' : '') +
      (p.course ? '<div><dt>Course</dt><dd>' + ph(p.course) + '</dd></div>' : '') +
      (p.collaborators ? '<div><dt>Collaborators</dt><dd>' + ph(p.collaborators) + '</dd></div>' : '') +
      '</dl>' + topicChips(p.categories) + '</div></header>' +
      '<div class="container narrow"><p class="post-excerpt">' + ph(p.summary) + '</p><div class="prose">' + md(p.body) + '</div>' +
      (actions.length ? '<p class="btn-row">' + actions.join('') + '</p>' : '<p class="placeholder-box">' + ph('[[No file or link yet — add one in the content editor under Research & projects.]]') + '</p>') +
      (p.tags.length ? '<div class="tags-row"><h2 class="h-small">Tags</h2>' + tagList(p.tags) + '</div>' : '') +
      '<p><a href="#/research">← Back to all research and projects</a></p></div></article>';
    return { title: plain(p.title), html: html };
  }

  function allTags() {
    var counts = {};
    D.posts.forEach(function (p) { p.tags.forEach(function (t) { var k = t.toLowerCase(); counts[k] = counts[k] || { name: t, n: 0 }; counts[k].n++; }); });
    return Object.keys(counts).map(function (k) { return counts[k]; }).sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name); });
  }

  function viewTopics() {
    var html = pageHeader('Topics', 'Topics', 'Posts are organised under eight themes from the programme. Choose a topic to see everything I\'ve written about it.') +
      '<div class="container"><ul class="topic-grid">' + D.topics.map(function (t) {
        var n = D.posts.filter(function (p) { return p.categories.indexOf(t.slug) > -1; }).length;
        return '<li class="topic-card"><a href="#/topics/' + esc(t.slug) + '">' + icon(t.icon, 'topic-icon') +
          '<span class="tc-name">' + esc(t.name) + '</span><span class="tc-desc">' + ph(t.description) + '</span>' +
          '<span class="tt-count">' + n + (n === 1 ? ' post' : ' posts') + '</span></a></li>';
      }).join('') + '</ul>' +
      '<section class="section" aria-labelledby="tags-h"><h2 id="tags-h" class="section-title">Browse by tag</h2><ul class="tag-cloud">' +
      allTags().map(function (t) { return '<li><a class="tag" href="' + tagHref(t.name) + '">#' + esc(t.name) + ' <span class="muted">(' + t.n + ')</span></a></li>'; }).join('') +
      '</ul></section></div>';
    return { title: 'Topics', html: html };
  }

  function viewTopic(slug) {
    var t = topicBy(slug);
    if (!t) return viewNotFound();
    var posts = D.posts.filter(function (p) { return p.categories.indexOf(slug) > -1; });
    var projects = D.projects.filter(function (p) { return p.categories.indexOf(slug) > -1; });
    var res = (D.resources.items || []).filter(function (r) { return (r.topics || []).indexOf(slug) > -1; });
    var html = '<header class="page-header"><div class="container"><nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="#/">Home</a></li><li><a href="#/topics">Topics</a></li><li aria-current="page">' + esc(t.name) + '</li></ol></nav>' +
      '<div class="topic-head">' + icon(t.icon, 'topic-icon lg') + '<div><p class="eyebrow">Topic</p><h1 tabindex="-1">' + esc(t.name) + '</h1></div></div>' +
      '<p class="page-intro">' + ph(t.description) + '</p></div></header>' +
      '<div class="container"><h2 class="section-title">Posts</h2>' +
      (posts.length ? '<div class="post-list">' + posts.map(function (p) { return postCard(p, 3); }).join('') + '</div>' : '<p class="muted">No posts on this topic yet.</p>') +
      (projects.length ? '<h2 class="section-title spaced">Related research and projects</h2><div class="card-grid">' + projects.map(function (p) { return projectCard(p, 3); }).join('') + '</div>' : '') +
      (res.length ? '<h2 class="section-title spaced">Useful resources</h2><ul class="resource-list">' + res.map(resourceItem).join('') + '</ul>' : '') +
      '<p class="spaced"><a href="#/topics">← All topics</a></p></div>';
    return { title: t.name, html: html };
  }

  function viewTag(tag) {
    var key = String(tag || '').toLowerCase();
    var match = function (x) { return (x.tags || []).some(function (t) { return t.toLowerCase() === key; }); };
    var posts = D.posts.filter(match);
    var projects = D.projects.filter(match);
    var first = posts[0] || projects[0];
    var display = first ? first.tags.filter(function (t) { return t.toLowerCase() === key; })[0] : tag;
    var n = posts.length + projects.length;
    var html = pageHeader('Tag', '#' + esc(display), n + (n === 1 ? ' item' : ' items') + ' tagged “' + esc(display) + '”.') +
      '<div class="container">' +
      (posts.length ? '<h2 class="section-title">Journal posts</h2><div class="post-list">' + posts.map(function (p) { return postCard(p, 3); }).join('') + '</div>' : '') +
      (projects.length ? '<h2 class="section-title spaced">Research and projects</h2><div class="card-grid">' + projects.map(function (p) { return projectCard(p, 3); }).join('') + '</div>' : '') +
      (!n ? '<p class="muted">Nothing uses this tag yet.</p>' : '') +
      '<p class="spaced"><a href="#/topics">← Browse all topics and tags</a></p></div>';
    return { title: 'Tagged ' + display, html: html };
  }

  function resourceItem(r) {
    var title = ph(r.title);
    return '<li class="resource"><div class="res-main"><h3 class="res-title">' + (hasText(r.url) && safeUrl(r.url) ? extLink(r.url, title) : title) + '</h3>' +
      '<p class="res-meta">' + ph(r.author) + (r.year ? ' · ' + ph(r.year) : '') + '</p>' +
      (r.note ? '<p class="res-note">' + ph(r.note) + '</p>' : '') + '</div>' +
      ((r.topics || []).length ? topicChips(r.topics, true) : '') + '</li>';
  }

  function viewResources(q) {
    var items = D.resources.items || [];
    var types = RESOURCE_TYPES.slice();
    items.forEach(function (r) { if (types.indexOf(r.type) < 0) types.push(r.type); });
    var active = types.filter(function (t) { return (!q.type || q.type === t) && items.some(function (r) { return r.type === t; }); });
    var total = items.filter(function (r) { return !q.type || r.type === q.type; }).length;
    var html = pageHeader('Resources', 'Resources', ph(D.resources.intro)) +
      '<div class="container">' +
      '<nav class="filter-tabs" aria-label="Filter by resource type"><ul><li><a href="#/resources"' + (!q.type ? ' aria-current="page"' : '') + '>All</a></li>' +
      types.map(function (t) { return '<li><a href="#/resources' + qs({ type: t }) + '"' + (q.type === t ? ' aria-current="page"' : '') + '>' + esc(t) + '</a></li>'; }).join('') +
      '</ul></nav><p class="result-count" role="status">' + total + (total === 1 ? ' resource' : ' resources') + '</p>' +
      active.map(function (t) {
        return '<section class="res-group" aria-labelledby="rg-' + slugify(t) + '"><h2 id="rg-' + slugify(t) + '" class="section-title">' + esc(t) + '</h2><ul class="resource-list">' +
          items.filter(function (r) { return r.type === t; }).map(resourceItem).join('') + '</ul></section>';
      }).join('') +
      '<p class="muted small spaced">Links open external websites in a new tab. Inclusion doesn\'t imply endorsement. Spotted a broken link? <a href="#/contact">Let me know</a>.</p></div>';
    return { title: 'Resources', html: html };
  }

  function viewContact() {
    var s = settings();
    var social = socialLinks();
    var html = pageHeader('Contact', 'Get in touch', 'Questions, ideas for collaboration, reading suggestions or feedback on a post — I\'d be glad to hear from you.') +
      '<div class="container contact-grid"><div class="contact-form-wrap">' +
      formShell('contact', 'ct',
        '<div class="field-row">' +
        field({ id: 'ct-name', name: 'name', label: 'Full name', required: true, autocomplete: 'name', min: 2, max: 100 }) +
        field({ id: 'ct-email', name: 'email', label: 'Email address', type: 'email', required: true, autocomplete: 'email' }) +
        '</div>' +
        field({ id: 'ct-aff', name: 'affiliation', label: 'Organisation or institution', autocomplete: 'organization', max: 120 }) +
        field({ id: 'ct-subject', name: 'subject', label: 'What is this about?', short: 'Topic of your message', type: 'select', required: true, options: ['Academic collaboration', 'Question about a post', 'Research or project enquiry', 'Speaking or event invitation', 'Feedback on the website', 'Something else'] }) +
        field({ id: 'ct-msg', name: 'message', label: 'Message', type: 'textarea', required: true, min: 20, max: 3000, rows: 7, counter: true }) +
        field({ id: 'ct-consent', name: 'consent', label: 'I agree that my details will be used to reply to this message, as described in the <a href="#/privacy">privacy notice</a>.', short: 'Consent', type: 'checkbox', required: true }) +
        '<button class="btn btn-primary" type="submit">Send message</button>') +
      '</div><aside class="contact-aside" aria-label="Other ways to connect">' +
      '<div class="aside-card"><h2 class="aside-h">Professional profiles</h2>' + (social || '<p class="muted">' + ph('[[Add your LinkedIn, ORCID or other profile links in Settings → Social links. They will appear here automatically.]]') + '</p>') + '</div>' +
      '<div class="aside-card"><h2 class="aside-h">What to expect</h2><p>I usually reply within ' + ph('[[number]]') + ' working days. During exam periods it may take a little longer.</p></div>' +
      '<div class="aside-card"><h2 class="aside-h">Based at</h2><p>' + esc(s.programme || '') + '<br>' + esc(s.university || '') + '</p></div>' +
      '</aside></div>';
    return { title: 'Contact', html: html };
  }

  function searchAll(q) {
    var terms = String(q || '').toLowerCase().split(/\s+/).map(function (t) { return t.replace(/[^\w\-'’]/g, ''); }).filter(function (t) { return t.length > 1; });
    if (!terms.length) return null;
    function score(fields) {
      var total = 0;
      for (var i = 0; i < terms.length; i++) {
        var hit = false;
        for (var j = 0; j < fields.length; j++) {
          if (String(fields[j][0] || '').toLowerCase().indexOf(terms[i]) > -1) { total += fields[j][1]; hit = true; }
        }
        if (!hit) return 0;
      }
      return total;
    }
    function rank(list, fn) {
      return list.map(function (x) { return { x: x, s: score(fn(x)) }; }).filter(function (r) { return r.s > 0; })
        .sort(function (a, b) { return b.s - a.s; }).map(function (r) { return r.x; });
    }
    return {
      terms: terms,
      posts: rank(D.posts, function (p) {
        return [[p.title, 6], [p.tags.join(' '), 4], [p.categories.map(function (c) { var t = topicBy(c); return t ? t.name : c; }).join(' '), 4], [p.excerpt, 3], [p.type, 2], [p.body, 1]];
      }),
      projects: rank(D.projects, function (p) { return [[p.title, 6], [p.tags.join(' '), 4], [p.summary, 3], [p.type, 2], [p.body, 1]]; }),
      resources: rank(D.resources.items || [], function (r) { return [[r.title, 6], [r.author, 3], [r.note, 2], [r.type, 2]]; })
    };
  }
  function highlight(text, terms) {
    var e = esc(plain(text));
    var re = new RegExp('(' + terms.map(function (t) { return escRe(esc(t)); }).join('|') + ')', 'gi');
    return e.replace(re, '<mark>$1</mark>');
  }

  function viewSearch(q) {
    var term = q.q || '';
    var r = searchAll(term);
    var html = pageHeader('Search', 'Search', 'Search across journal posts, research and projects, and resources.') +
      '<div class="container narrow-wide">' +
      '<form class="search-form big" role="search" data-form="search" aria-label="Search this site"><label for="sp-q" class="sr-only">Search terms</label>' +
      '<input id="sp-q" name="q" type="search" value="' + esc(term) + '" placeholder="Try “energy justice” or “SDG 7”" autocomplete="off">' +
      '<button class="btn btn-primary" type="submit">Search</button></form>';
    if (!r) {
      html += '<p class="muted">Enter at least one word of two or more letters. Or browse by <a href="#/topics">topic</a>.</p></div>';
      return { title: 'Search', html: html };
    }
    var total = r.posts.length + r.projects.length + r.resources.length;
    html += '<p class="result-count" role="status">' + (total ? total + (total === 1 ? ' result' : ' results') + ' for “' + esc(term) + '”' : 'No results for “' + esc(term) + '”. Try a different word, or browse by <a href="#/topics">topic</a>.') + '</p>';
    if (r.posts.length) {
      html += '<section aria-labelledby="sr-posts"><h2 id="sr-posts" class="section-title">Journal posts (' + r.posts.length + ')</h2><ul class="search-results">' +
        r.posts.map(function (p) {
          return '<li><a class="sr-title" href="#/post/' + esc(p.slug) + '">' + highlight(p.title, r.terms) + '</a><p class="muted small">' + timeTag(p.date) + ' · ' + esc(p.type) + '</p><p>' + highlight(p.excerpt, r.terms) + '</p></li>';
        }).join('') + '</ul></section>';
    }
    if (r.projects.length) {
      html += '<section aria-labelledby="sr-proj"><h2 id="sr-proj" class="section-title">Research and projects (' + r.projects.length + ')</h2><ul class="search-results">' +
        r.projects.map(function (p) {
          return '<li><a class="sr-title" href="#/project/' + esc(p.slug) + '">' + highlight(p.title, r.terms) + '</a><p class="muted small">' + esc(p.type) + '</p><p>' + highlight(p.summary, r.terms) + '</p></li>';
        }).join('') + '</ul></section>';
    }
    if (r.resources.length) {
      html += '<section aria-labelledby="sr-res"><h2 id="sr-res" class="section-title">Resources (' + r.resources.length + ')</h2><ul class="search-results">' +
        r.resources.map(function (x) {
          return '<li>' + (safeUrl(x.url) ? extLink(x.url, highlight(x.title, r.terms), 'sr-title') : '<span class="sr-title">' + highlight(x.title, r.terms) + '</span>') +
            '<p class="muted small">' + esc(x.type) + ' · ' + esc(plain(x.author)) + '</p><p>' + highlight(x.note, r.terms) + '</p></li>';
        }).join('') + '</ul></section>';
    }
    html += '</div>';
    return { title: 'Search results', html: html };
  }

  function viewSimplePage(key) {
    var pg = D.pages[key];
    if (!pg) return viewNotFound();
    var html = pageHeader('', ph(pg.title)) + '<div class="container narrow"><div class="prose">' + md(pg.body) + '</div></div>';
    return { title: plain(pg.title), html: html };
  }

  function viewModerationDemo() {
    if (!PREVIEW) return viewNotFound();
    var html = pageHeader('Preview only', 'Comment moderation demo',
      'This page only exists in the offline preview. It shows how moderation works: comments wait here until you approve them. On your live site, the same steps happen in your Netlify dashboard and the content editor (see the guide).') +
      '<div class="container">' +
      '<section class="section" aria-labelledby="mq-h"><h2 id="mq-h" class="section-title">Waiting for review (' + S.pending.length + ')</h2>';
    if (!S.pending.length) {
      html += '<p class="muted">No comments are waiting. Open any <a href="#/journal">journal post</a>, submit a test comment, then come back here.</p>';
    } else {
      html += '<ul class="mod-list">' + S.pending.map(function (c) {
        return '<li class="mod-item"><p class="muted small">On “<a href="#/post/' + esc(c.slug) + '">' + esc(c.title) + '</a>” · ' + timeTag(c.date) + '</p>' +
          '<p><strong>' + esc(c.name) + '</strong>' + (c.affiliation ? ' · ' + esc(c.affiliation) : '') + ' <span class="muted">(' + esc(c.email) + ')</span></p>' +
          '<div class="comment-body">' + md(c.text) + '</div>' +
          '<div class="btn-row"><button type="button" class="btn btn-primary" data-action="approve" data-id="' + c.id + '">Approve and publish</button>' +
          '<button type="button" class="btn btn-ghost" data-action="remove" data-id="' + c.id + '">Remove</button>' +
          '<button type="button" class="btn btn-link" data-action="spam" data-id="' + c.id + '">Mark as spam</button></div></li>';
      }).join('') + '</ul>';
    }
    html += '</section><section class="section" aria-labelledby="ms-h"><h2 id="ms-h" class="section-title">Subscribers collected in this preview (' + S.subscribers.length + ')</h2>' +
      (S.subscribers.length ? '<ul class="plain-list">' + S.subscribers.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' : '<p class="muted">Use any subscribe form to add a test address.</p>') +
      '</section><section class="section" aria-labelledby="mm-h"><h2 id="mm-h" class="section-title">Contact messages received in this preview (' + S.messages.length + ')</h2>' +
      (S.messages.length ? '<ul class="plain-list">' + S.messages.map(function (m) { return '<li><strong>' + esc(m.subject) + '</strong> — ' + esc(m.name) + ' (' + esc(m.email) + ')</li>'; }).join('') + '</ul>' : '<p class="muted">Send a test message from the <a href="#/contact">contact page</a>.</p>') +
      '</section></div>';
    return { title: 'Moderation demo', html: html };
  }

  function viewNotFound() {
    return {
      title: 'Page not found',
      html: pageHeader('', 'Page not found', 'Sorry — that page doesn\'t exist or may have moved.') +
        '<div class="container"><p class="btn-row"><a class="btn btn-primary" href="#/">Go to the home page</a><a class="btn btn-ghost" href="#/search">Search the site</a></p></div>'
    };
  }

  function resolve(path) {
    var r = parsePath(path), p = r.parts, q = r.query;
    var view;
    switch (p[0] || '') {
      case '': view = viewHome(); break;
      case 'about': view = viewAbout(); break;
      case 'journal': view = viewJournal(q); break;
      case 'post': view = viewPost(p[1]); break;
      case 'research': view = viewResearch(q); break;
      case 'project': view = viewProject(p[1]); break;
      case 'topics': view = p[1] ? viewTopic(p[1]) : viewTopics(); break;
      case 'tags': view = viewTag(p[1]); break;
      case 'resources': view = viewResources(q); break;
      case 'contact': view = viewContact(); break;
      case 'search': view = viewSearch(q); break;
      case 'guidelines': view = viewSimplePage('guidelines'); break;
      case 'privacy': view = viewSimplePage('privacy'); break;
      case 'accessibility': view = viewSimplePage('accessibility'); break;
      case 'moderation-demo': view = viewModerationDemo(); break;
      default: view = viewNotFound();
    }
    view.section = p[0] || '';
    return view;
  }

  /* ------------------------------------------------------------ browser runtime */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function announce(msg) {
    var a = document.getElementById('announcer');
    if (!a) return;
    a.textContent = '';
    setTimeout(function () { a.textContent = msg; }, 60);
  }

  function setNavState(section) {
    $$('#primary-nav a[data-nav]').forEach(function (a) {
      var n = NAV.filter(function (x) { return x.key === a.getAttribute('data-nav'); })[0];
      var on = n && (n.key === section || (n.also || []).indexOf(section) > -1);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function closeDrawers(except) {
    [['toggle-menu', 'primary-nav'], ['toggle-search', 'header-search'], ['toggle-display', 'display-panel']].forEach(function (d) {
      if (d[0] === except) return;
      var b = $('[data-action="' + d[0] + '"]');
      var el = document.getElementById(d[1]);
      if (b) b.setAttribute('aria-expanded', 'false');
      if (el) {
        if (d[1] === 'primary-nav') el.classList.remove('open'); else el.hidden = true;
      }
    });
    document.body.classList.remove('menu-open');
  }

  function render(path, moveFocus) {
    current = path;
    var main = document.getElementById('main');
    var view;
    try { view = resolve(path); } catch (e) { view = viewNotFound(); if (window.console) console.error(e); }
    main.innerHTML = view.html;
    document.title = view.title + ' — ' + siteTitle();
    setNavState(view.section);
    closeDrawers();
    var scrollTarget = null;
    if (!firstRender) {
      try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
    }
    if (moveFocus && !firstRender) {
      var h1 = main.querySelector('h1');
      if (h1) { try { h1.focus({ preventScroll: true }); } catch (e) { h1.focus(); } }
      announce(view.title);
    }
    firstRender = false;
    afterRender(view);
    return scrollTarget;
  }

  function afterRender(view) {
    // live character counters
    $$('[data-counter-for]').forEach(function (c) {
      var f = document.getElementById(c.getAttribute('data-counter-for'));
      if (f) updateCounter(f);
    });
    // stamp forms for time-based spam check
    $$('form[data-form]').forEach(function (f) { f.setAttribute('data-ts', String(Date.now())); });
    // Giscus (GitHub sign-in comments), only when configured
    var gw = document.getElementById('giscus-thread');
    if (gw && view.post) {
      var g = (settings().comments || {}).giscus || {};
      var sc = document.createElement('script');
      sc.src = 'https://giscus.app/client.js';
      sc.async = true;
      sc.crossOrigin = 'anonymous';
      var theme = document.documentElement.getAttribute('data-theme');
      var attrs = {
        'data-repo': g.repo, 'data-repo-id': g.repoId, 'data-category': g.category || 'Comments', 'data-category-id': g.categoryId,
        'data-mapping': 'specific', 'data-term': view.post.slug, 'data-strict': '1', 'data-reactions-enabled': '1',
        'data-emit-metadata': '0', 'data-input-position': 'top', 'data-lang': 'en', 'data-loading': 'lazy',
        'data-theme': theme === 'dark' ? 'dark' : theme === 'contrast' ? 'light_high_contrast' : 'preferred_color_scheme'
      };
      Object.keys(attrs).forEach(function (k) { sc.setAttribute(k, attrs[k]); });
      gw.appendChild(sc);
    }
  }

  function routeFromLocation() {
    var h = String(window.location.hash || '');
    if (h === '' || h === '#' || h === '#/') return '/';
    if (h.indexOf('#/') === 0) return h.slice(1);
    return null; // in-page anchor such as #main — not a route
  }

  function go(path) {
    if (path === current) { render(path, true); return; }
    try { window.history.pushState(null, '', '#' + path); } catch (e) { /* sandboxed preview */ }
    render(path, true);
  }

  /* --- display preferences */
  function applyPrefs() {
    var root = document.documentElement;
    var size = store.get('pref-text') || 'base';
    var theme = store.get('pref-theme') || 'auto';
    var spacing = store.get('pref-spacing') === '1';
    var underline = store.get('pref-underline') === '1';
    if (size === 'base') root.removeAttribute('data-text'); else root.setAttribute('data-text', size);
    if (theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    root.classList.toggle('pref-spacing', spacing);
    root.classList.toggle('pref-underline', underline);
    $$('[data-action="text-size"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-value') === size)); });
    $$('[data-action="theme"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-value') === theme)); });
    $$('[data-action="spacing"]').forEach(function (b) { b.setAttribute('aria-pressed', String(spacing)); });
    $$('[data-action="underline"]').forEach(function (b) { b.setAttribute('aria-pressed', String(underline)); });
  }
  var memPrefs = {};
  function setPref(k, v) { memPrefs[k] = v; store.set(k, v); }
  var origGet = store.get;
  store.get = function (k) { var v = origGet(k); return v == null ? (memPrefs[k] == null ? null : memPrefs[k]) : v; };

  /* --- forms */
  function updateCounter(f) {
    var c = document.getElementById(f.id + '-count');
    if (!c) return;
    var max = parseInt(f.getAttribute('maxlength'), 10) || 0;
    var n = f.value.length;
    c.textContent = n + ' / ' + max + ' characters';
    c.classList.toggle('near', max && n > max * 0.9);
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function validateForm(form) {
    var errors = [];
    $$('input, textarea, select', form).forEach(function (f) {
      if (f.type === 'hidden' || f.name === 'bot-field' || !f.id) return;
      var label = f.getAttribute('data-label') || f.name;
      var v = f.type === 'checkbox' ? (f.checked ? 'yes' : '') : String(f.value || '').trim();
      var msg = '';
      var min = parseInt(f.getAttribute('minlength'), 10) || 0;
      var max = parseInt(f.getAttribute('maxlength'), 10) || 0;
      if (f.required && !v) {
        msg = f.type === 'checkbox' ? 'Please tick this box to continue.' : f.tagName === 'SELECT' ? 'Please choose an option.' : 'Please enter your ' + label.replace(/\s*\(.*\)$/, '').toLowerCase() + '.';
      } else if (v && f.type === 'email' && !EMAIL_RE.test(v)) {
        msg = 'Please enter a valid email address, like name@example.com.';
      } else if (v && min && v.length < min) {
        msg = label.replace(/\s*\(.*\)$/, '') + ' needs at least ' + min + ' characters.';
      } else if (v && max && v.length > max) {
        msg = label.replace(/\s*\(.*\)$/, '') + ' must be ' + max + ' characters or fewer.';
      }
      var err = document.getElementById(f.id + '-err');
      if (msg) {
        f.setAttribute('aria-invalid', 'true');
        if (err) { err.textContent = msg; err.hidden = false; }
        errors.push({ id: f.id, msg: (f.type === 'checkbox' || f.tagName === 'SELECT') ? label + ': ' + msg.charAt(0).toLowerCase() + msg.slice(1) : msg });
      } else {
        f.removeAttribute('aria-invalid');
        if (err) { err.textContent = ''; err.hidden = true; }
      }
    });
    var sum = form.querySelector('.error-summary');
    if (sum) {
      if (errors.length > 1) {
        sum.innerHTML = '<p><strong>Please fix ' + errors.length + ' problems:</strong></p><ul>' +
          errors.map(function (e) { return '<li><a href="#' + e.id + '" data-focus="' + e.id + '">' + esc(e.msg) + '</a></li>'; }).join('') + '</ul>';
        sum.hidden = false;
        sum.focus();
      } else {
        sum.hidden = true;
        sum.innerHTML = '';
        if (errors.length) document.getElementById(errors[0].id).focus();
      }
    }
    return errors.length === 0;
  }

  function setStatus(form, kind, html) {
    var st = form.querySelector('.form-status');
    if (!st) return;
    st.className = 'form-status ' + kind;
    st.innerHTML = html;
  }

  function formValues(form) {
    var o = {};
    $$('input, textarea, select', form).forEach(function (f) {
      if (!f.name) return;
      o[f.name] = f.type === 'checkbox' ? (f.checked ? 'yes' : '') : f.value;
    });
    return o;
  }

  function submitToHost(name, values) {
    var body = new URLSearchParams();
    body.append('form-name', name);
    Object.keys(values).forEach(function (k) { body.append(k, values[k]); });
    return fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })
      .then(function (r) { if (!r.ok) throw new Error('Status ' + r.status); return r; });
  }

  var SUCCESS = {
    contact: '<strong>Thank you — your message has been sent.</strong> I\'ll reply by email as soon as I can.',
    comment: '<strong>Thank you — your comment has been received.</strong> It will appear here once it has been reviewed.',
    subscribe: '<strong>You\'re subscribed.</strong> Thanks for following along.'
  };
  var NETLIFY_NAMES = { contact: 'contact', comment: 'comments', subscribe: 'subscribe' };

  function handleForm(form) {
    var kind = form.getAttribute('data-form');
    if (kind === 'search') {
      var q = (form.querySelector('input[name="q"]').value || '').trim();
      go('/search' + qs({ q: q }));
      return;
    }
    if (kind === 'journal-filter') {
      var v = formValues(form);
      go('/journal' + qs({ type: v.type, topic: v.topic, sort: v.sort }));
      return;
    }
    if (!validateForm(form)) { setStatus(form, '', ''); return; }
    var values = formValues(form);
    var btn = form.querySelector('button[type="submit"]');
    var done = function () {
      var extra = '';
      if (PREVIEW && kind === 'comment') extra = ' <a href="#/moderation-demo">Open the moderation demo</a> to approve it (preview only).';
      setStatus(form, 'success', SUCCESS[kind] + extra);
      $$('input:not([type="hidden"]), textarea, select', form).forEach(function (f) { if (f.type === 'checkbox') f.checked = false; else f.value = ''; });
      $$('[data-counter-for]', form).forEach(function (c) { var f = document.getElementById(c.getAttribute('data-counter-for')); if (f) updateCounter(f); });
      if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
      var st = form.querySelector('.form-status');
      if (st) { st.setAttribute('tabindex', '-1'); st.focus(); }
    };
    // Spam traps: hidden honeypot field, and submissions faster than a human could type
    var started = parseInt(form.getAttribute('data-ts'), 10) || 0;
    if (values['bot-field'] || (!PREVIEW && Date.now() - started < 3000)) { done(); return; }
    delete values['bot-field'];

    if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
    setStatus(form, 'info', 'Sending…');

    if (PREVIEW) {
      if (kind === 'comment') {
        var p = postBy(form.getAttribute('data-slug'));
        S.pending.push({ id: ++S.seq, slug: p.slug, title: plain(p.title), name: values.name.trim(), email: values.email.trim(), affiliation: values.affiliation.trim(), text: values.comment.trim(), date: todayIso() });
        var pn = document.querySelector('.pending-note');
        var note = '<p class="pending-note">' + S.pending.filter(function (c) { return c.slug === p.slug; }).length + ' comment(s) awaiting moderation. <a href="#/moderation-demo">Open the moderation demo</a> to approve or remove.</p>';
        if (pn) pn.outerHTML = note; else { var wrap = document.querySelector('.comment-form-wrap'); if (wrap) wrap.insertAdjacentHTML('beforebegin', note); }
      } else if (kind === 'subscribe') {
        S.subscribers.push(values.email.trim());
      } else if (kind === 'contact') {
        S.messages.push({ name: values.name, email: values.email, subject: values.subject });
      }
      setTimeout(done, 400);
      return;
    }
    submitToHost(NETLIFY_NAMES[kind], values).then(done).catch(function () {
      if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
      setStatus(form, 'error', '<strong>Sorry, that didn\'t go through.</strong> Please check your connection and try again in a moment.');
    });
  }

  function copyLink(btn) {
    var url = btn.getAttribute('data-url');
    var st = btn.closest('.share').querySelector('.copy-status');
    function ok() { st.textContent = 'Link copied to your clipboard.'; }
    function fallback() {
      st.innerHTML = '<label for="copy-field">Copy this link:</label> <input id="copy-field" class="copy-field" readonly value="' + esc(url) + '">';
      var f = document.getElementById('copy-field');
      f.focus(); f.select();
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }

  function moderate(action, id) {
    id = parseInt(id, 10);
    var idx = -1;
    S.pending.forEach(function (c, i) { if (c.id === id) idx = i; });
    if (idx < 0) return;
    var c = S.pending.splice(idx, 1)[0];
    if (action === 'approve') {
      (S.approved[c.slug] = S.approved[c.slug] || []).push({ name: c.name, affiliation: c.affiliation, date: c.date, text: c.text });
    }
    render(current, false);
    announce(action === 'approve' ? 'Comment approved and published.' : action === 'spam' ? 'Comment marked as spam and removed.' : 'Comment removed.');
    var h = document.getElementById('mq-h');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  }

  function toggle(btnAction, targetId) {
    var b = $('[data-action="' + btnAction + '"]');
    var el = document.getElementById(targetId);
    var open = b.getAttribute('aria-expanded') !== 'true';
    closeDrawers(btnAction);
    b.setAttribute('aria-expanded', String(open));
    if (targetId === 'primary-nav') {
      el.classList.toggle('open', open);
      document.body.classList.toggle('menu-open', open);
      if (open) { var first = el.querySelector('a'); if (first) first.focus(); }
    } else {
      el.hidden = !open;
      if (open) { var f = el.querySelector('input, button'); if (f) f.focus(); }
    }
  }

  function bind() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (a) {
        var href = a.getAttribute('href') || '';
        if (a.hasAttribute('data-focus')) {
          e.preventDefault();
          var t = document.getElementById(a.getAttribute('data-focus'));
          if (t) t.focus();
          return;
        }
        if (a.hasAttribute('data-scroll')) {
          e.preventDefault();
          var sc = document.getElementById(a.getAttribute('data-scroll'));
          if (sc) { sc.scrollIntoView({ behavior: 'smooth' }); var h = sc.querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
          return;
        }
        if (href === '#main') {
          e.preventDefault();
          var m = document.getElementById('main');
          var h1 = m.querySelector('h1') || m;
          h1.focus();
          return;
        }
        if (href.indexOf('#/') === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
          e.preventDefault();
          go(href.slice(1));
          return;
        }
        return;
      }
      var b = e.target.closest('[data-action]');
      if (!b) return;
      var act = b.getAttribute('data-action');
      if (act === 'toggle-menu') toggle('toggle-menu', 'primary-nav');
      else if (act === 'toggle-search') toggle('toggle-search', 'header-search');
      else if (act === 'toggle-display') toggle('toggle-display', 'display-panel');
      else if (act === 'text-size') { setPref('pref-text', b.getAttribute('data-value')); applyPrefs(); announce('Text size changed.'); }
      else if (act === 'theme') { setPref('pref-theme', b.getAttribute('data-value')); applyPrefs(); announce('Colour theme changed.'); }
      else if (act === 'spacing') { setPref('pref-spacing', b.getAttribute('aria-pressed') === 'true' ? '0' : '1'); applyPrefs(); }
      else if (act === 'underline') { setPref('pref-underline', b.getAttribute('aria-pressed') === 'true' ? '0' : '1'); applyPrefs(); }
      else if (act === 'copy-link') copyLink(b);
      else if (act === 'approve' || act === 'remove' || act === 'spam') moderate(act, b.getAttribute('data-id'));
    });

    document.addEventListener('submit', function (e) {
      var f = e.target.closest('form[data-form]');
      if (!f) return;
      e.preventDefault();
      handleForm(f);
    });

    document.addEventListener('input', function (e) {
      var f = e.target;
      if (f && f.id && document.getElementById(f.id + '-count')) updateCounter(f);
      if (f && f.getAttribute && f.getAttribute('aria-invalid') === 'true') {
        f.removeAttribute('aria-invalid');
        var err = document.getElementById(f.id + '-err');
        if (err) { err.hidden = true; err.textContent = ''; }
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var openBtn = $('.header-tools [aria-expanded="true"]');
        if (openBtn) { closeDrawers(); openBtn.focus(); }
      }
    });

    window.addEventListener('hashchange', function () {
      var r = routeFromLocation();
      if (r !== null && r !== current) render(r, true);
    });
    window.addEventListener('popstate', function () {
      var r = routeFromLocation();
      if (r !== null && r !== current) render(r, true);
    });
  }

  function start(data) {
    D = data;
    document.getElementById('site-header').innerHTML = headerHtml();
    document.getElementById('site-footer').innerHTML = footerHtml();
    applyPrefs();
    bind();
    render(routeFromLocation() || '/', false);
  }

  function fail() {
    document.getElementById('main').innerHTML = '<div class="container section"><h1>Sorry, the site could not load</h1><p>Please refresh the page. If the problem continues, the site may be updating — try again in a minute.</p></div>';
  }

  if (isBrowser && document.getElementById('main')) {
    var boot = function () {
      if (window.__SITE_DATA__) { start(window.__SITE_DATA__); return; }
      fetch('/data/site-data.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(start).catch(fail);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }

  // Exposed for automated checks (no effect on the website)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      setData: function (d, preview) { D = d; PREVIEW = !!preview; },
      resolve: resolve, headerHtml: headerHtml, footerHtml: footerHtml, md: md, searchAll: searchAll, state: S
    };
  }
})();
