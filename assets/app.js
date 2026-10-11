(function () {
  'use strict';
  var D = window.YS, FL = window.YS_FLAGS || {}, GEO = window.YS_GEO, NS = 'http://www.w3.org/2000/svg';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function el(t, a, x) { var e = document.createElement(t); for (var k in (a || {})) e.setAttribute(k, a[k]); if (x != null) e.textContent = x; return e; }
  function sv(t, a, x) { var e = document.createElementNS(NS, t); for (var k in (a || {})) e.setAttribute(k, a[k]); if (x != null) e.textContent = x; return e; }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  var N = {}; D.nations.forEach(function (n) { N[n.name] = n; });
  var POSN = { G: 'Goalkeeper', D: 'Defender', M: 'Midfielder', F: 'Forward' };
  var state = { measure: 'trained', sel: '', pins: true, shown: 48 };
  $('#updated').textContent = D.meta.updated;

  /* flags and codes */
  function flag(name, h) {
    h = h || 14; var n = N[name], s = n && n.a2 && FL[n.a2], w = Math.round(h * 4 / 3);
    if (!s) return el('span', { class: 'flag', style: 'width:' + w + 'px;height:' + h + 'px;background:var(--line)' });
    return el('img', { class: 'flag', alt: '', width: w, height: h, src: 'data:image/svg+xml;utf8,' + encodeURIComponent(s) });
  }
  function code(name) { return N[name] ? N[name].code : String(name || '').slice(0, 3).toUpperCase(); }
  function tag(name, h) { var s = el('span', { style: 'display:inline-flex;gap:6px;align-items:center' }); s.appendChild(flag(name, h)); s.appendChild(el('b', null, code(name))); return s; }

  /* tooltip */
  var tip = el('div', { class: 'tip', role: 'status' }); document.body.appendChild(tip);
  function showTip(ev, lines) { tip.textContent = ''; lines.forEach(function (l, i) { var d = el('div', null, l); if (!i) d.style.fontWeight = 700; tip.appendChild(d); }); tip.style.opacity = 1; var w = tip.offsetWidth, x = ev.clientX + 14; if (x + w > innerWidth - 8) x = ev.clientX - w - 14; tip.style.left = Math.max(8, x) + 'px'; tip.style.top = (ev.clientY + 14) + 'px'; }
  function hideTip() { tip.style.opacity = 0; }

  /* measures */
  var MEAS = {
    trained: ['Trained in', 'Players by the country of the youth club they were at by age 15.'],
    first: ['First youth team', 'Players by the first national youth team they played for.'],
    final: ['Play for', 'Players by the nation they play for today.']
  };
  function val(n, m) { return n ? n[m] : null; }
  function mix(a, b, t) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }); }
  function rgb(hex) { hex = hex.replace('#', ''); if (hex.length === 3) hex = hex.replace(/./g, '$&$&'); return [0, 2, 4].map(function (i) { return parseInt(hex.substr(i, 2), 16); }); }
  function ramp(t) { var c = mix(rgb(css('--ramp0')), rgb(css('--ramp1')), t); return 'rgb(' + c.join(',') + ')'; }

  /* ---------- map ---------- */
  var map, geoLayer, pinLayer, layerByNation = {};
  var UKN = 'England';   // the UK outline carries England's figures
  function natOfFeature(f) { var nm = f.properties.nation; return nm || null; }
  function initMap() {
    if (!window.L) { $('#map').appendChild(el('p', { class: 'hint', style: 'padding:20px' }, 'The map library did not load. The rest of the dashboard still works.')); return; }
    map = L.map('map', { zoomSnap: .25, minZoom: 2, worldCopyJump: false, attributionControl: true, zoomControl: false, scrollWheelZoom: true });
    var dark = css('--bg') < '#40';   // theme check below
    var isDark = getComputedStyle(document.body).colorScheme === 'dark' || document.documentElement.getAttribute('data-theme') === 'dark' || (matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.getAttribute('data-theme') !== 'light');
    var ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
    L.tileLayer(ESRI + (isDark ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base') + '/MapServer/tile/{z}/{y}/{x}', { maxZoom: 12, attribution: 'Tiles &copy; Esri' }).addTo(map);
    map.createPane('shade'); map.getPane('shade').style.zIndex = 300;
    geoLayer = L.geoJSON(GEO, { pane: 'shade', style: styleFor, onEachFeature: function (f, l) {
      var nn = natOfFeature(f); if (nn) layerByNation[nn] = l;
      l.on('mousemove', function (e) { var n = nn && N[nn]; showTip(e.originalEvent, n ? [(f.properties.name === 'United Kingdom' ? 'England (UK outline)' : nn), MEAS[state.measure][0] + ': ' + val(n, state.measure)] : [f.properties.name, 'No players in this data']); });
      l.on('mouseout', hideTip);
      l.on('click', function () { if (nn) select(nn === state.sel ? '' : nn); });
    } }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    pinLayer = L.layerGroup().addTo(map);
    // labels on top of shading
    map.createPane('labels'); map.getPane('labels').style.zIndex = 650; map.getPane('labels').style.pointerEvents = 'none';
    L.tileLayer(ESRI + (isDark ? 'World_Dark_Gray_Reference' : 'World_Light_Gray_Reference') + '/MapServer/tile/{z}/{y}/{x}', { pane: 'labels', maxZoom: 12 }).addTo(map);
    view('eu');
    drawPins();
  }
  var VIEWS = { eu: [[35.5, -11], [60.5, 31]], sa: [[-40, -75], [6, -33]], world: [[-45, -90], [62, 45]] };
  function view(k) { if (!map) return; map.fitBounds(VIEWS[k], { animate: false }); document.querySelectorAll('.mapbar [data-view]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.view === k); }); }
  function styleFor(f) {
    var nn = natOfFeature(f), n = nn && N[nn], v = val(n, state.measure), max = maxVal();
    var on = nn && nn === state.sel;
    return { fillColor: v != null ? ramp(.12 + .88 * Math.sqrt(v / max)) : 'transparent', fillOpacity: v != null ? .78 : 0, color: on ? css('--hl') : css('--ink3'), weight: on ? 2.6 : .6, opacity: on ? 1 : .55 };
  }
  function maxVal() { return Math.max.apply(null, D.nations.map(function (n) { return val(n, state.measure) || 0; })) || 1; }
  function drawPins() {
    if (!map) return; pinLayer.clearLayers(); if (!state.pins) return;
    D.pins.forEach(function (p) {
      var on = state.sel && p.country === state.sel;
      var m = L.circleMarker([p.lat, p.lon], { radius: 3.5 + 2.6 * Math.sqrt(p.n), color: '#fff', weight: 1, fillColor: css('--hl'), fillOpacity: on ? .95 : (state.sel ? .35 : .8) });
      m.bindTooltip(p.club + ' (' + code(p.country) + '): ' + p.n + (p.n === 1 ? ' player' : ' players') + ' - ' + p.names.slice(0, 3).join(', ') + (p.n > 3 ? '...' : ''), { direction: 'top' });
      m.on('click', function () {
        var box = el('div', { class: 'pop' }); box.appendChild(el('b', null, p.club + ' - ' + p.n + (p.n === 1 ? ' player' : ' players')));
        (p.allNames || p.names).forEach(function (nm) { box.appendChild(el('div', null, nm)); });
        m.bindPopup(box).openPopup();
      });
      m.addTo(pinLayer);
    });
  }
  function legend() {
    var max = maxVal(), box = $('#legend'); box.textContent = '';
    box.appendChild(el('div', null, MEAS[state.measure][0] + ' (players)'));
    box.appendChild(el('div', { class: 'ramp' })); var r = el('div', { class: 'row' }); r.appendChild(el('span', null, '1')); r.appendChild(el('span', null, String(max))); box.appendChild(r);
    var d = el('div', { style: 'margin-top:4px' }); d.innerHTML = '<i></i>Youth club, sized by players'; box.appendChild(d);
    box.appendChild(el('div', { style: 'margin-top:4px' }, 'The UK outline shows England.'));
  }

  /* ---------- side panel ---------- */
  function renderMeasure() {
    var box = $('#measure'); box.textContent = '';
    Object.keys(MEAS).forEach(function (k) { var b = el('button', { type: 'button', 'aria-pressed': state.measure === k }, MEAS[k][0]); b.onclick = function () { state.measure = k; refresh(); }; box.appendChild(b); });
    $('#mhint').textContent = MEAS[state.measure][1];
  }
  function renderRank() {
    var m = state.measure, list = D.nations.slice().sort(function (a, b) { return val(b, m) - val(a, m); }).filter(function (n) { return val(n, m) > 0; });
    var top = list.slice(0, 14); if (state.sel && !top.some(function (n) { return n.name === state.sel; })) { var s = N[state.sel]; if (s) top.push(s); }
    var max = val(list[0], m) || 1, ol = $('#rank'); ol.textContent = '';
    top.forEach(function (n) {
      var li = el('li', { tabindex: 0, role: 'button', 'aria-selected': n.name === state.sel });
      li.appendChild(flag(n.name, 13)); li.appendChild(el('b', null, n.code));
      var bar = el('div', { class: 'bar' }); var i = el('i'); i.style.width = (100 * val(n, m) / max) + '%'; bar.appendChild(i); li.appendChild(bar);
      li.appendChild(el('span', { class: 'v num' }, String(val(n, m))));
      var go = function () { select(n.name === state.sel ? '' : n.name); }; li.onclick = go; li.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
      li.title = n.name; ol.appendChild(li);
    });
  }
  function renderDossier() {
    var box = $('#dossier'); box.textContent = ''; var n = N[state.sel]; if (!n) return;
    var d = el('div', { class: 'dossier' }), x = el('button', { class: 'x', type: 'button' }, 'Clear'); x.onclick = function () { select(''); }; d.appendChild(x);
    var h = el('h3'); h.appendChild(flag(n.name, 22)); h.appendChild(document.createTextNode(n.name + ' (' + n.code + ')')); d.appendChild(h);
    var dl = el('dl');
    [['Trained here', n.trained], ['First youth team', n.first], ['Play for', n.final], ['Trained minus play for', (n.net > 0 ? '+' : '') + n.net], ['Squad players', n.entrants == null ? 'n/a' : n.entrants], ['Became elite', n.hit == null ? 'n/a' : n.hit.toFixed(1) + '%']].forEach(function (p) { var w = el('div'); w.appendChild(el('dt', null, p[0])); w.appendChild(el('dd', { class: 'num' }, String(p[1]))); dl.appendChild(w); });
    d.appendChild(dl);
    var ps = D.players.filter(function (p) { return p.tc === n.name; }).map(function (p) { return p.n; });
    d.appendChild(el('p', { class: 'names' }, ps.length ? 'Trained here: ' + ps.slice(0, 12).join(', ') + (ps.length > 12 ? ' and ' + (ps.length - 12) + ' more' : '') + '.' : 'No players in the pool were trained here.'));
    box.appendChild(d);
  }
  function select(name) {
    state.sel = name || ''; $('#hl').value = state.sel; refresh();
    if (map && name && layerByNation[name]) { try { var b = layerByNation[name].getBounds(); if (name === 'France') b = L.latLngBounds([41, -5], [51.5, 9.5]); map.fitBounds(b, { maxZoom: 6, padding: [40, 40] }); } catch (e) {} }
    else if (map && !name) view('eu');
  }

  /* ---------- charts ---------- */
  var SER = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6'];
  var ORDER = ['France', 'Spain', 'Germany', 'England', 'Italy', 'Brazil'];   // fixed colour slots, never re-assigned
  function colorOf(name) { var i = ORDER.indexOf(name); return i >= 0 ? css(SER[i]) : css('--neutral'); }
  function niceMax(v) { var s = [1, 2, 2.5, 5, 10], p = Math.pow(10, Math.floor(Math.log10(v))); for (var i = 0; i < s.length; i++) if (s[i] * p >= v) return s[i] * p; return 10 * p; }
  function lineChart(box, opt) {
    box.textContent = ''; var W = Math.max(300, box.clientWidth || 600), H = Math.round(Math.min(340, Math.max(220, W * .5)));
    var L = 42, R = 92, T = 12, B = 30, pw = W - L - R, ph = H - T - B, n = opt.x.length;
    var vals = [].concat.apply([], opt.series.map(function (s) { return s.vals.filter(function (v) { return v != null; }); }));
    var lo = opt.min != null ? opt.min : 0, hi = opt.max != null ? opt.max : niceMax(Math.max.apply(null, vals) * 1.05), step = opt.step || (hi - lo) / 4;
    var X = function (i) { return L + pw * i / (n - 1); }, Y = function (v) { return T + ph * (1 - (v - lo) / (hi - lo)); };
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opt.label });
    for (var v = lo; v <= hi + 1e-9; v += step) { svg.appendChild(sv('line', { x1: L, x2: L + pw, y1: Y(v), y2: Y(v), stroke: css('--line') })); svg.appendChild(sv('text', { x: L - 8, y: Y(v) + 4, 'text-anchor': 'end' }, opt.fmt(v))); }
    opt.x.forEach(function (t, i) { svg.appendChild(sv('text', { x: X(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }, t)); });
    var ends = [];
    opt.series.forEach(function (s) {
      var pts = s.vals.map(function (v, i) { return v == null ? null : [X(i), Y(v)]; }), d = '';
      pts.forEach(function (p) { if (p) d += (d ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); });
      svg.appendChild(sv('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': s.hl ? 3 : 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: s.dim ? .75 : 1, 'stroke-dasharray': s.dash || '' }));
      pts.forEach(function (p) { if (p) svg.appendChild(sv('circle', { cx: p[0], cy: p[1], r: s.hl ? 4 : 3, fill: s.color, stroke: css('--panel'), 'stroke-width': 2 })); });
      var li = s.vals.length - 1; while (li > 0 && s.vals[li] == null) li--;
      if (s.vals[li] != null) ends.push({ y: Y(s.vals[li]), name: s.short || s.name, v: s.vals[li], x: X(li) });
    });
    ends.sort(function (a, b) { return a.y - b.y; });
    for (var i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
    ends.forEach(function (e) { svg.appendChild(sv('text', { x: e.x + 10, y: e.y + 4, style: 'fill:var(--ink);font-weight:600' }, e.name + ' ' + opt.fmt(e.v))); });
    // hover
    var cross = sv('line', { y1: T, y2: T + ph, stroke: css('--ink3'), 'stroke-dasharray': '3 3', opacity: 0 }); svg.appendChild(cross);
    var hit = sv('rect', { x: L, y: T, width: pw, height: ph, fill: 'transparent' }); svg.appendChild(hit);
    hit.addEventListener('mousemove', function (ev) {
      var r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) * W / r.width, i = Math.max(0, Math.min(n - 1, Math.round((x - L) / pw * (n - 1))));
      cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('opacity', 1);
      var rows = opt.series.filter(function (s) { return s.vals[i] != null; }).sort(function (a, b) { return b.vals[i] - a.vals[i]; }).map(function (s) { return s.name + ': ' + opt.fmt(s.vals[i]); });
      showTip(ev, [opt.x[i]].concat(rows));
    });
    hit.addEventListener('mouseleave', function () { cross.setAttribute('opacity', 0); hideTip(); });
    box.appendChild(svg);
  }
  function legendFor(box, series) {
    box.textContent = ''; series.forEach(function (s) { var sp = el('span'); var i = el('i'); i.style.background = s.color; sp.appendChild(i); sp.appendChild(document.createTextNode(s.name)); box.appendChild(sp); });
  }
  function highlightSeries(name) { return name === state.sel; }
  function renderCohorts() {
    var C = D.cohorts, want = ['France', 'Spain', 'Germany', 'England', 'Italy', 'Brazil'];
    var ss = want.map(function (nm) { var s = C.series.filter(function (x) { return x.name === nm; })[0]; return s && { name: nm, short: code(nm), vals: s.vals, color: colorOf(nm), hl: nm === state.sel }; }).filter(Boolean);
    if (state.sel && want.indexOf(state.sel) < 0) { var s = C.series.filter(function (x) { return x.name === state.sel; })[0]; if (s) ss.push({ name: state.sel, short: code(state.sel), vals: s.vals, color: css('--hl'), hl: true }); }
    lineChart($('#cohChart'), { x: C.labels.map(function (l) { return 'Born ' + l.replace(' or earlier', ' or earlier').replace('2000 onward', '2000 on'); }), series: ss, fmt: function (v) { return v.toFixed(v % 1 ? 1 : 0) + '%'; }, min: 0, max: 20, step: 5, label: 'Share of each birth cohort by first youth team' });
    legendFor($('#cohLegend'), ss);
  }
  function bars(box, E, capEl) {
    box.textContent = ''; var W = Math.max(300, box.clientWidth || 500), rows = E.series, rh = 38, H = 34 + rows.length * rh, L = 56, pw = W - L - 40;
    var mx = Math.max.apply(null, [].concat.apply([], rows.map(function (r) { return r.vals; }))) || 1;
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Players reaching the top-50 tier early, by nation and birth cohort' });
    var c = [css('--neutral'), css('--accent')];
    rows.forEach(function (r, i) {
      var y = 26 + i * rh, on = r.name === state.sel;
      svg.appendChild(sv('text', { x: 0, y: y + 22, style: 'fill:var(--ink);font-weight:600' }, code(r.name)));
      r.vals.forEach(function (v, j) {
        var w = pw * v / mx, yy = y + j * 15;
        var rect = sv('rect', { x: L, y: yy + 3, width: Math.max(w, 1.5), height: 12, rx: 3, fill: on ? css('--hl') : c[j], opacity: j ? 1 : .55 }); svg.appendChild(rect);
        svg.appendChild(sv('text', { x: L + w + 6, y: yy + 13 }, String(v)));
        rect.addEventListener('mousemove', function (ev) { showTip(ev, [r.name, E.cohorts[j] + ': ' + v + ' of ' + E.totals[j] + ' players in the pool']); }); rect.addEventListener('mouseleave', hideTip);
      });
    });
    var lg = [[E.cohorts[0], c[0], .55], [E.cohorts[1], c[1], 1]];
    lg.forEach(function (l, k) { svg.appendChild(sv('rect', { x: L + k * 150, y: 2, width: 10, height: 10, rx: 2, fill: l[1], opacity: l[2] })); svg.appendChild(sv('text', { x: L + k * 150 + 15, y: 11 }, l[0])); });
    box.appendChild(svg);
  }
  function renderEarly() {
    bars($('#e23'), D.early['By age 23']); bars($('#e21'), D.early['By age 21']);
    $('#e23cap').textContent = 'Pool players by first youth team. Totals: ' + D.early['By age 23'].totals.join(' and ') + ' players.';
    $('#e21cap').textContent = 'Counts are small, so read the direction. Totals: ' + D.early['By age 21'].totals.join(' and ') + ' players.';
  }
  function renderSquads() {
    var S = D.squads, want = ['France', 'Spain', 'Germany', 'England', 'Italy', 'Brazil'];
    function mk(key, fmt, opt) {
      var ss = [{ name: 'All squads', short: 'All', vals: S.field[key], color: css('--ink3'), dash: '5 4', dim: true }];
      var names = want.slice(); if (state.sel && names.indexOf(state.sel) < 0) names.push(state.sel);
      names.forEach(function (nm) { var t = S.teams.filter(function (x) { return x.name === nm; })[0]; if (t) ss.push({ name: nm, short: code(nm), vals: t[key], color: nm === state.sel && want.indexOf(nm) < 0 ? css('--hl') : colorOf(nm), hl: nm === state.sel }); });
      return ss;
    }
    var a = mk('age'), u = mk('u23');
    lineChart($('#ageChart'), { x: S.tours, series: a, fmt: function (v) { return v.toFixed(1); }, min: 24, max: 30, step: 2, label: 'Average squad age by tournament' });
    lineChart($('#u23Chart'), { x: S.tours, series: u, fmt: function (v) { return v.toFixed(0) + '%'; }, min: 0, max: 40, step: 10, label: 'Share of squad under 23 by tournament' });
    legendFor($('#sqLegend'), a);
  }
  function renderHit() {
    var rows = D.nations.filter(function (n) { return n.entrants >= 60; }).sort(function (a, b) { return b.hit - a.hit; }), tb = $('#hitTable tbody'); tb.textContent = '';
    var mx = Math.max.apply(null, rows.map(function (r) { return r.hit; }));
    rows.forEach(function (n) {
      var tr = el('tr'); if (n.name === state.sel) tr.className = 'sel';
      var c0 = el('td'); c0.appendChild(tag(n.name, 13)); tr.appendChild(c0);
      tr.appendChild(el('td', { class: 'num' }, String(n.entrants))); tr.appendChild(el('td', { class: 'num' }, String(n.elite)));
      var c3 = el('td', { class: 'num' }); var m = el('span', { class: 'mini' }); m.style.width = (60 * n.hit / mx) + 'px'; if (n.name === state.sel) m.style.background = 'var(--hl)'; c3.appendChild(m); c3.appendChild(document.createTextNode(n.hit.toFixed(1) + '%')); tr.appendChild(c3);
      tr.appendChild(el('td', { class: 'num' }, n.hit_early == null ? '-' : n.hit_early.toFixed(1) + '%')); tr.appendChild(el('td', { class: 'num' }, n.hit_late == null ? '-' : n.hit_late.toFixed(1) + '%'));
      tb.appendChild(tr);
    });
  }

  /* ---------- wiring ---------- */
  function refresh() {
    renderMeasure(); renderRank(); renderDossier(); legend();
    if (geoLayer) geoLayer.setStyle(styleFor); drawPins(); renderCohorts(); renderSquads(); renderHit(); renderEarly();
  }
  function init() {
    var sel = $('#hl'); sel.appendChild(el('option', { value: '' }, 'None'));
    D.nations.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; }).forEach(function (n) { sel.appendChild(el('option', { value: n.name }, n.name + ' (' + n.code + ')')); });
    sel.onchange = function () { select(sel.value); };
    document.querySelectorAll('.mapbar [data-view]').forEach(function (b) { b.onclick = function () { view(b.dataset.view); }; });
    $('#pinsBtn').onclick = function () { state.pins = !state.pins; this.setAttribute('aria-pressed', state.pins); drawPins(); };
    initMap(); refresh();
    var t; addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { renderCohorts(); renderSquads(); renderEarly(); }, 150); });
    matchMedia('(prefers-color-scheme: dark)').addEventListener && matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { location.reload(); });
  }
  init();
})();
