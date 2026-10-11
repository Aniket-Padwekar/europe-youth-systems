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
  function showTip(ev, lines) { var host = $('#card') && $('#card').open ? $('#card') : document.body; if (tip.parentNode !== host) host.appendChild(tip); tip.textContent = ''; lines.forEach(function (l, i) { var d = el('div', null, l); if (!i) d.style.fontWeight = 700; tip.appendChild(d); }); tip.style.opacity = 1; var w = tip.offsetWidth, x = ev.clientX + 14; if (x + w > innerWidth - 8) x = ev.clientX - w - 14; tip.style.left = Math.max(8, x) + 'px'; tip.style.top = (ev.clientY + 14) + 'px'; }
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
        (p.allNames || p.names).forEach(function (nm, i) { var bt = el('button', { type: 'button' }, nm); bt.onclick = function () { openCard(p.ids[i]); }; box.appendChild(bt); });
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
    var L = 46, R = 104, T = 12, B = 40, pw = W - L - R, ph = H - T - B, n = opt.x.length;
    var vals = [].concat.apply([], opt.series.map(function (s) { return s.vals.filter(function (v) { return v != null; }); }));
    var lo = opt.min != null ? opt.min : 0, hi = opt.max != null ? opt.max : niceMax(Math.max.apply(null, vals) * 1.05), step = opt.step || (hi - lo) / 4;
    var X = function (i) { return L + pw * i / (n - 1); }, Y = function (v) { return T + ph * (1 - (v - lo) / (hi - lo)); };
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opt.label });
    for (var v = lo; v <= hi + 1e-9; v += step) { svg.appendChild(sv('line', { x1: L, x2: L + pw, y1: Y(v), y2: Y(v), stroke: css('--line') })); svg.appendChild(sv('text', { x: L - 8, y: Y(v) + 4, 'text-anchor': 'end' }, opt.fmt(v))); }
    opt.x.forEach(function (t, i) { var pr = String(t).split(' '), anc = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'; if (pr.length === 2 && /^\d{4}$/.test(pr[1])) { svg.appendChild(sv('text', { x: X(i), y: H - 18, 'text-anchor': anc }, pr[1])); svg.appendChild(sv('text', { x: X(i), y: H - 3, 'text-anchor': anc, style: 'font-size:12px;fill:var(--ink3)' }, pr[0])); } else svg.appendChild(sv('text', { x: X(i), y: H - 8, 'text-anchor': anc }, t)); });
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
    ends.forEach(function (e) { svg.appendChild(sv('text', { x: e.x + 10, y: e.y + 4, style: 'fill:var(--ink);font-weight:600;font-size:14px' }, e.name + ' ' + opt.fmt(e.v))); });
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
  /* ---------- cohort bars (early arrival and youth squad to elite) ---------- */
  var COH = [['Until 1999', 1900, 1999], ['2000-2005', 2000, 2005], ['2006-2010', 2006, 2010]];
  var AGES = [16, 17, 18, 19, 20, 21, 22, 23], FIRST_SEASON = 2016, LAST_SEASON = 2025;
  function obs(age, c) { var lo = Math.max(c[1], FIRST_SEASON - age), hi = Math.min(c[2], LAST_SEASON - age); return lo <= hi ? [lo, hi] : null; }
  function cohortColors() { return [ramp(.35), ramp(.65), ramp(1)]; }
  function ageSelect(sel, fn) { AGES.forEach(function (a) { sel.appendChild(el('option', { value: a }, a === 16 ? '16 (earliest)' : String(a))); }); sel.value = 23; sel.onchange = fn; }
  function legendCoh(box, age) {
    box.textContent = ''; var cs = cohortColors();
    COH.forEach(function (c, i) { var o = obs(age, c); if (!o) return; var sp = el('span'), sw = el('i'); sw.style.background = cs[i]; sp.appendChild(sw); sp.appendChild(document.createTextNode(c[0] + ' (born ' + (o[0] === o[1] ? o[0] : o[0] + '-' + o[1]) + ')')); box.appendChild(sp); });
  }
  function cohortBars(box, rows, fmt) {
    box.textContent = ''; rows = rows.filter(function (r) { return r.cells.some(Boolean); });
    var W = Math.max(320, box.clientWidth || 600), L = 62, pw = W - L - 130, cs = cohortColors(), gap = 16, bh = 14, step = 18;
    var H = 8, ys = rows.map(function (r) { var y = H, k = r.cells.filter(Boolean).length; H += k * step + gap; return y; }); H += 4;
    var mx = Math.max.apply(null, [].concat.apply([], rows.map(function (r) { return r.cells.map(function (c) { return c && c.v || 0; }); }))) || 1;
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Bars by nation and birth cohort' });
    rows.forEach(function (r, i) {
      var y = ys[i], on = r.name === state.sel, k = r.cells.filter(Boolean).length, idx = 0;
      svg.appendChild(sv('text', { x: 0, y: y + (k * step - 4) / 2 + 5, style: 'fill:var(--ink);font-weight:700;font-size:14px' }, code(r.name)));
      r.cells.forEach(function (c, j) {
        if (!c) return;
        var yy = y + idx * step; idx++;
        var w = c.v > 0 ? Math.max(pw * c.v / mx, 2) : 0, col = on ? css('--hl') : cs[j];
        var rect = sv('rect', { x: L, y: yy, width: w || 1.5, height: bh, rx: 3, fill: col, opacity: w ? (on ? [.5, .75, 1][j] : 1) : .35 }); svg.appendChild(rect);
        svg.appendChild(sv('text', { x: L + (w || 1.5) + 7, y: yy + 12, style: 'font-size:13px;fill:var(--ink)' }, c.label));
        rect.addEventListener('mousemove', function (ev) { showTip(ev, [r.name + ', ' + COH[j][0], c.tip]); }); rect.addEventListener('mouseleave', hideTip);
      });
    });
    box.appendChild(svg);
  }
  function earlyRows() {
    var age = +$('#earlyAge').value, names = ['France', 'Spain', 'Germany', 'England', 'Italy', 'Brazil', 'Argentina', 'Portugal'];
    if (state.sel && names.indexOf(state.sel) < 0 && N[state.sel]) names.push(state.sel);
    return names.map(function (nm) {
      return { name: nm, cells: COH.map(function (c) {
        var o = obs(age, c); if (!o) return null;
        var ps = D.players.filter(function (p) { return p.first === nm && p.by >= o[0] && p.by <= o[1]; }), n = ps.filter(function (p) { return p.fa != null && p.fa <= age; }).length;
        return { v: n, label: String(n), tip: n + ' players reached the top 50 by age ' + age + ' (' + ps.length + ' pool players born ' + o[0] + '-' + o[1] + ')' };
      }) };
    });
  }
  function renderEarly() {
    var age = +$('#earlyAge').value; cohortBars($('#earlyChart'), earlyRows()); legendCoh($('#earlyLegend'), age);
    $('#earlyNote').textContent = 'Nation is the first youth national team. Ratings start in 2016/17, so only players born in ' + (FIRST_SEASON - age) + ' or later can be seen at age ' + age + ', and players must be old enough to have reached it by 2025/26. Counts are small; read the direction. Only four players in the pool were born in 2005 or later, and only one in 2006 or later, so the newest cohort is thin.';
  }
  function hitRows() {
    var age = +$('#hitAge').value, nats = D.nations.filter(function (n) { return D.hitrows.some(function (r) { return r[0] === n.name; }); }).sort(function (a, b) { return (b.hit || 0) - (a.hit || 0); }).map(function (n) { return n.name; });
    var cnt = {}; D.hitrows.forEach(function (r) { cnt[r[0]] = (cnt[r[0]] || 0) + 1; });
    var keep = nats.slice().sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 12); if (state.sel && nats.indexOf(state.sel) >= 0 && keep.indexOf(state.sel) < 0) keep.push(state.sel);
    nats = nats.filter(function (x) { return keep.indexOf(x) >= 0; });
    return nats.map(function (nm) {
      return { name: nm, cells: COH.map(function (c) {
        var o = obs(age, c); if (!o) return null;
        var rs = D.hitrows.filter(function (r) { return r[0] === nm && r[1] >= o[0] && r[1] <= o[1]; }), n = rs.length, e = rs.filter(function (r) { return r[2] != null && r[2] <= age; }).length;
        if (n < 15) return null;
        var v = 100 * e / n; return { v: v, label: v.toFixed(1) + '% (' + e + ' of ' + n + ')', tip: e + ' of ' + n + ' youth squad players born ' + o[0] + '-' + o[1] + ' reached the top 50 by age ' + age };
      }) };
    });
  }
  function renderHit() {
    var age = +$('#hitAge').value; cohortBars($('#hitChart'), hitRows()); legendCoh($('#hitLegend'), age);
    $('#hitNote').textContent = 'Squads are U17, U19 and U21 European Championship squads. A cohort is left out when it cannot be observed at the chosen age or has fewer than 15 squad players. The 12 countries with the most youth-squad players are shown, ordered by overall hit rate.';
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
  /* ---------- player card ---------- */
  var POSN = { G: 'Goalkeeper', D: 'Defender', M: 'Midfielder', F: 'Forward' };
  function photoBox(p, big) {
    var b = el('div', { class: 'ph' }); b.appendChild(el('span', { class: 'mono' }, p.n.split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('')));
    if (p.photo && p.photo[0]) { var i = el('img', { alt: p.n, loading: 'lazy', src: 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(p.photo[0]) + '?width=' + (big ? 520 : 340) }); i.onerror = function () { i.remove(); }; b.appendChild(i); }
    return b;
  }
  function openCard(id) {
    var p = D.players.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var body = $('#cardbody'); body.textContent = '';
    var g = el('div', { class: 'dg' }); g.appendChild(photoBox(p, true));
    var b = el('div', { class: 'body' }); b.appendChild(el('h3', null, p.n));
    var sub = el('p', { class: 'hint', style: 'margin:6px 0 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap' }); sub.appendChild(tag(p.nat, 15)); sub.appendChild(document.createTextNode((POSN[p.pos] || '') + (p.by ? ', born ' + p.by : ''))); b.appendChild(sub);
    var kv = el('dl', { class: 'kv' });
    [['First youth team', code(p.first)], ['Trained in', p.tc ? code(p.tc) : 'n/a'], ['Senior caps (goals)', p.caps + ' (' + p.goals + ')']].forEach(function (r) { var d = el('div'); d.appendChild(el('dt', null, r[0])); d.appendChild(el('dd', null, r[1])); kv.appendChild(d); });
    b.appendChild(kv);
    var tags = el('div', { class: 'tags' }), HN = { GoldenBoy: 'Golden Boy', Kopa: 'Kopa Trophy', PFA: 'PFA Young Player', 'PL Player of Season': 'Premier League Player of the Season', 'UEFA Player of Year': 'UEFA Player of the Year' };
    if (p.bd) tags.appendChild(el('span', null, "Ballon d'Or top 30: best finish " + p.bd[0] + ', ' + p.bd[1] + (p.bd[1] === 1 ? ' time' : ' times')));
    (p.hon || []).forEach(function (h) { tags.appendChild(el('span', null, (HN[h[0]] || h[0]) + ' ' + h[1])); });
    if (tags.children.length) b.appendChild(tags);
    if (p.path && p.path.length) { b.appendChild(el('h3', { style: 'font-size:18px;margin-top:14px' }, 'Youth path')); var ul = el('ul', { class: 'path' }); p.path.forEach(function (r) { var li = el('li'); li.appendChild(el('span', { class: 'num', style: 'color:var(--ink2);min-width:7.5em' }, r[1])); li.appendChild(el('span', null, r[0])); if (r[2]) li.appendChild(tag(r[2], 12)); ul.appendChild(li); }); b.appendChild(ul); }
    if (p.mv && p.mv.length > 1) b.appendChild(mvChart(p.mv));
    if (p.photo && p.photo[0]) { var cr = el('p', { class: 'credit' }); cr.appendChild(document.createTextNode('Photo: ' + (p.photo[2] || 'unknown author') + ', ' + (p.photo[1] || 'see source') + ', via ')); cr.appendChild(el('a', { href: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(p.photo[0].replace(/ /g, '_')), target: '_blank', rel: 'noopener' }, 'Wikimedia Commons')); b.appendChild(cr); }
    g.appendChild(b); body.appendChild(g); var dlg = $('#card'); if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
  }
  function mvChart(mv) {
    var W = 460, H = 170, L = 38, R = 14, T = 14, B = 24, pw = W - L - R, ph = H - T - B;
    var x0 = mv[0][0], x1 = mv[mv.length - 1][0], mx = Math.max.apply(null, mv.map(function (r) { return r[1]; })), top = niceMax(mx * 1.05);
    var X = function (y) { return L + pw * (y - x0) / ((x1 - x0) || 1); }, Y = function (v) { return T + ph * (1 - v / top); };
    var box = el('div', { style: 'margin-top:14px' }); box.appendChild(el('h3', { style: 'font-size:18px' }, 'Market value (EUR million)'));
    box.appendChild(el('p', { class: 'hint', style: 'margin:2px 0 4px' }, 'Value at the end of each year. Hover for the figure.'));
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Market value by year, peak ' + mx.toFixed(0) + ' million euros' });
    for (var k = 0; k <= 4; k++) { var v = top * k / 4; svg.appendChild(sv('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: css('--line') })); svg.appendChild(sv('text', { x: L - 6, y: Y(v) + 4, 'text-anchor': 'end', style: 'font:11px sans-serif;fill:var(--ink2)' }, String(Math.round(v)))); }
    var step = Math.max(1, Math.ceil((x1 - x0) / 6)); for (var y = x0; y <= x1; y += step) svg.appendChild(sv('text', { x: X(y), y: H - 6, 'text-anchor': 'middle', style: 'font:11px sans-serif;fill:var(--ink2)' }, String(y)));
    var d = ''; mv.forEach(function (r) { d += (d ? 'L' : 'M') + X(r[0]).toFixed(1) + ',' + Y(r[1]).toFixed(1); });
    svg.appendChild(sv('path', { d: d, fill: 'none', stroke: css('--accent'), 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
    var pk = mv.filter(function (r) { return r[1] === mx; })[0];
    svg.appendChild(sv('circle', { cx: X(pk[0]), cy: Y(pk[1]), r: 4.5, fill: css('--hl'), stroke: css('--panel'), 'stroke-width': 2 }));
    svg.appendChild(sv('text', { x: Math.min(X(pk[0]), W - R - 60), y: Y(pk[1]) - 9, style: 'font:600 11px sans-serif;fill:var(--ink)' }, 'Peak ' + mx.toFixed(0) + ' (' + pk[0] + ')'));
    var cross = sv('line', { y1: T, y2: T + ph, stroke: css('--ink3'), 'stroke-dasharray': '3 3', opacity: 0 }), dot = sv('circle', { r: 4, fill: css('--accent'), opacity: 0 }); svg.appendChild(cross); svg.appendChild(dot);
    var hit = sv('rect', { x: L, y: T, width: pw, height: ph, fill: 'transparent' }); svg.appendChild(hit);
    hit.addEventListener('mousemove', function (ev) {
      var r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) * W / r.width, best = mv[0];
      mv.forEach(function (q) { if (Math.abs(X(q[0]) - x) < Math.abs(X(best[0]) - x)) best = q; });
      cross.setAttribute('x1', X(best[0])); cross.setAttribute('x2', X(best[0])); cross.setAttribute('opacity', 1); dot.setAttribute('cx', X(best[0])); dot.setAttribute('cy', Y(best[1])); dot.setAttribute('opacity', 1);
      showTip(ev, [String(best[0]), 'EUR ' + best[1].toFixed(1) + ' million']);
    });
    hit.addEventListener('mouseleave', function () { cross.setAttribute('opacity', 0); dot.setAttribute('opacity', 0); hideTip(); });
    box.appendChild(svg); return box;
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
    var cc = $('#cclose'); if (cc) cc.onclick = function () { $('#card').close(); };
    $('#card').addEventListener('click', function (e) { if (e.target === this) this.close(); });
    ageSelect($('#earlyAge'), renderEarly); ageSelect($('#hitAge'), renderHit);
    initMap(); refresh();
    var t; addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { renderCohorts(); renderSquads(); renderEarly(); }, 150); });
    matchMedia('(prefers-color-scheme: dark)').addEventListener && matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { location.reload(); });
  }
  window.YS_openCard = openCard;
  init();
})();
