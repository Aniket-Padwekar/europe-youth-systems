(function () {
  'use strict';
  var D = window.GT, $ = function (s, r) { return (r || document).querySelector(s); };
  var HOVER = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var S = { grp: 'all', m: 'last', yr: 2026, view: 'club', sel: null, all: false };
  var CLS = ['Bundesliga only (Big-5 data)', 'Bundesliga and another Big-5 league', 'Only outside the Bundesliga', ''];
  var SRC = ['Wikipedia', 'Transfermarkt', 'Wikipedia and Transfermarkt', ''];
  var cityPos = {}; (function () { var t = {}; D.clubs.forEach(function (c) { (t[c.city] = t[c.city] || []).push(c); }); Object.keys(t).forEach(function (k) { var a = t[k]; cityPos[k] = [a.reduce(function (s, c) { return s + c.lat; }, 0) / a.length, a.reduce(function (s, c) { return s + c.lon; }, 0) / a.length]; }); })();
  var map, layer, isDark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  var ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function median(a) { if (!a.length) return 0; a = a.slice().sort(function (x, y) { return x - y; }); var h = a.length >> 1; return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2; }
  function inEra(p) { return p[12] <= S.yr; }
  function pool() { return D.players.filter(function (p) { return (S.grp === 'all' || p[8] === S.grp) && inEra(p); }); }
  function credits(p) { var y = p[3]; if (!y.length) return p[9] >= 0 ? [p[9]] : []; if (S.m === 'last') return [y[y.length - 1]]; if (S.m === 'first') return [y[0]]; var o = []; y.forEach(function (i) { if (o.indexOf(i) < 0) o.push(i); }); return o; }
  function keyOf(i) { return S.view === 'city' ? D.clubs[i].city : D.clubs[i].n; }
  function compute() {
    var P = pool(), g = {}, known = 0;
    P.forEach(function (p) { var c = credits(p); if (c.length) known++; var seen = {}; c.forEach(function (i) { var k = keyOf(i); if (seen[k]) return; seen[k] = 1; (g[k] = g[k] || []).push(p); }); });
    var items = Object.keys(g).map(function (k) { var pos = S.view === 'city' ? cityPos[k] : (function () { var c = D.clubs.filter(function (x) { return x.n === k; })[0]; return [c.lat, c.lon]; })(); return { k: k, n: g[k].length, pl: g[k], lat: pos[0], lon: pos[1], city: S.view === 'club' ? D.clubs.filter(function (x) { return x.n === k; })[0].city : '' }; }).sort(function (a, b) { return b.n - a.n || (a.k < b.k ? -1 : 1); });
    return { P: P, known: known, items: items };
  }
  var MH = { last: 'The German professional club whose youth side he was in just before turning professional. One credit per player. Players from amateur clubs are credited to the pro club they first signed for.', first: 'The first professional club in his youth career. One credit per player. Players with no pro academy are credited to the club they first signed for.', any: 'Every professional club he passed through. Players count once for each club, so totals are higher.' };
  function stats(pl) { var ab = pl.filter(function (p) { return p[4] === 1 || p[4] === 2; }).length, b5 = pl.filter(function (p) { return p[5].length; }).length; return { ab: ab, b5: b5, med: median(pl.map(function (p) { return p[2]; })) }; }
  function pct(a, b) { return b ? Math.round(100 * a / b) + '%' : 'n/a'; }

  function initMap() {
    map = L.map('map', { zoomSnap: .25, minZoom: 5.5, maxBounds: [[46.2, 4.8], [55.6, 16.2]], maxBoundsViscosity: 1, attributionControl: true, zoomControl: false, scrollWheelZoom: true });
    L.geoJSON(window.DE_STATES, { interactive: false, className: 'deland', style: function () { return { weight: 1, fillOpacity: 1 }; } }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    layer = L.layerGroup().addTo(map);
    map.fitBounds([[47.2, 5.8], [54.9, 15.2]], { padding: [10, 10] });
  }
  function drawMap(R) {
    layer.clearLayers();
    var col = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#0A7F5C', hl = getComputedStyle(document.documentElement).getPropertyValue('--hl').trim() || '#C4540E';
    R.items.slice().reverse().forEach(function (it) {
      var sel = S.sel === it.k, r = 3.5 + Math.sqrt(it.n) * (S.view === 'city' ? 2.1 : 2.5);
      var m = L.circleMarker([it.lat, it.lon], { radius: r, color: sel ? hl : '#fff', weight: sel ? 3 : 1.5, fillColor: sel ? hl : col, fillOpacity: .78 }).addTo(layer);
      var box = document.createElement('div'); box.className = 'pop';
      box.innerHTML = '<b>' + esc(it.k) + (it.city && it.city !== it.k ? ' <small>(' + esc(it.city) + ')</small>' : '') + '</b><span class="num">' + it.n + ' player' + (it.n > 1 ? 's' : '') + '</span>';
      it.pl.slice().sort(function (a, b) { return b[2] - a[2]; }).slice(0, 40).forEach(function (p) { var b = document.createElement('button'); b.type = 'button'; b.textContent = p[0] + ' (' + p[1] + ')'; b.onclick = function () { openCard(p); }; box.appendChild(b); });
      m.bindPopup(box);
      if (HOVER) m.bindTooltip(esc(it.k) + ': ' + it.n, { direction: 'top', offset: [0, -r] });
      m.on('click', function () { S.sel = it.k; renderSide(R); drawMap(R); });
    });
    var mx = R.items.length ? R.items[0].n : 1;
    $('#legend').innerHTML = '<div class="row"><span><i></i>Circle size = players credited</span></div><div class="row"><span>Largest: ' + (R.items[0] ? esc(R.items[0].k) + ', ' + mx : 'none') + '</span></div>';
  }
  function renderSide(R) {
    var unitCl = S.view === 'city' ? 'cities' : 'clubs';
    $('#mhint').textContent = MH[S.m] + ' Credited for ' + R.known + ' of ' + R.P.length + ' players.';
    var mx = R.items.length ? R.items[0].n : 1, rk = $('#rank'); rk.innerHTML = '';
    var shown = S.all ? R.items : R.items.slice(0, 14);
    shown.forEach(function (it, i) {
      var li = document.createElement('li'); li.setAttribute('aria-selected', S.sel === it.k ? 'true' : 'false'); li.tabIndex = 0;
      li.innerHTML = '<span class="num" style="width:1.6em;text-align:right;color:var(--ink3);font-size:13px">' + (i + 1) + '</span><b></b><span class="bar"><i style="width:' + (100 * it.n / mx) + '%"></i></span><span class="v num">' + it.n + '</span>';
      li.children[1].remove(); li.insertBefore(Object.assign(document.createElement('b'), { textContent: it.k }), li.children[1]);
      li.style.gridTemplateColumns = '1.6em minmax(0,1.3fr) 1fr 2.2em';
      var go = function () { S.sel = S.sel === it.k ? null : it.k; renderSide(R); drawMap(R); if (S.sel) { map.flyTo([it.lat, it.lon], Math.max(map.getZoom(), 7), { duration: .6 }); } };
      li.onclick = go; li.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
      rk.appendChild(li);
    });
    var mb = $('#moreBtn'); mb.hidden = R.items.length <= 14; mb.textContent = S.all ? 'Show top 14' : 'Show all ' + R.items.length + ' ' + unitCl;
    var sel = R.items.filter(function (x) { return x.k === S.sel; })[0], dos = $('#dossier');
    if (!sel) { sel = R.items[0]; var lead = true; }
    if (!sel) { dos.innerHTML = '<div class="dossier"><p>No players in this selection.</p></div>'; return; }
    var st = stats(sel.pl), small = sel.n < 8 ? '<p class="hint" style="margin:8px 0 0">Small sample: read this as a description, not a rate.</p>' : '';
    dos.innerHTML = '<div class="dossier"><h3>' + esc(sel.k) + '</h3><p class="hint" style="margin:4px 0 0">' + (lead ? 'Top of the list. Click a circle or a row to change. ' : '') + sel.n + ' of ' + R.known + ' players (' + pct(sel.n, R.known) + ')</p>' +
      '<dl><div><dt>Played outside the Bundesliga</dt><dd class="num">' + pct(st.ab, sel.n) + '</dd></div><div><dt>Another Big-5 country</dt><dd class="num">' + pct(st.b5, sel.n) + '</dd></div><div><dt>Median Big-5 league apps</dt><dd class="num">' + (Math.round(st.med * 10) / 10) + '</dd></div></dl>' + small + '<div class="names" id="dn"></div></div>';
    var dn = $('#dn');
    sel.pl.slice().sort(function (a, b) { return b[2] - a[2]; }).forEach(function (p, i) { var b = document.createElement('button'); b.type = 'button'; b.className = 'nm'; b.textContent = p[0]; b.onclick = function () { openCard(p); }; if (i) dn.appendChild(document.createTextNode(', ')); dn.appendChild(b); });
  }
  function openCard(p) {
    var body = $('#cardbody'), path = p[3].map(function (i) { return D.clubs[i]; });
    var li = path.length ? path.map(function (c) { return '<li>' + esc(c.n) + ' <span style="color:var(--ink3);font-size:12.5px">' + esc(c.city) + '</span></li>'; }).join('') : '<li>No pro academy found. He came through amateur clubs.</li>';
    body.innerHTML = '<div class="dg" style="grid-template-columns:1fr"><div class="body"><h3>' + esc(p[0]) + '</h3><div class="tags"><span>Born ' + p[1] + '</span><span>' + (p[8] === 'de' ? 'Played for Germany' : 'Citizenship: ' + esc(p[7])) + '</span>' + (p[6] === 3 ? '' : '<span>Youth path: ' + SRC[p[6]] + '</span>') + '</div>' +
      '<dl class="kv"><div><dt>Big-5 league apps</dt><dd class="num">' + p[2] + '</dd></div><div><dt>League career</dt><dd style="font-size:14px">' + CLS[p[4]] + '</dd></div><div><dt>Other Big-5 league</dt><dd style="font-size:14px">' + (p[5].length ? esc(p[5].join(', ')) : 'No') + '</dd></div></dl>' +
      '<h4 style="margin:6px 0 0;font-size:14px">German academies, in order</h4><ol class="path" style="list-style:none">' + li + '</ol>' + (!path.length && p[9] >= 0 ? '<p class="hint">Entered pro football at: ' + esc(D.clubs[p[9]].n) + '</p>' : '') + '</div></div>';
    var d = $('#card'); if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  }
  function render() { var R = compute(); if (S.sel && !R.items.some(function (x) { return x.k === S.sel; })) S.sel = null; renderSide(R); drawMap(R); renderLede(R); }
  function renderLede(R) {
    if ($('#yrn')) $('#yrn').textContent = R.P.length.toLocaleString('en-US') + ' of ' + D.pool.n.toLocaleString('en-US') + ' players';
    $('#lede').textContent = D.pool.n.toLocaleString('en-US') + ' players born in Germany, with a real career in a Big-5 league from the 1990s to 2026. The map shows the German club that developed each one. Move the slider to see the talent build up by first appearance. Click a circle or a name for the player.';
  }
  function bind() {
    if ($('#updated')) $('#updated').textContent = D.updated;
    document.querySelectorAll('[data-grp]').forEach(function (b) { b.onclick = function () { S.grp = b.dataset.grp; S.sel = null; document.querySelectorAll('[data-grp]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); render(); }; });
    document.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = function () { S.view = b.dataset.view; S.sel = null; document.querySelectorAll('[data-view]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); render(); }; });
    document.querySelectorAll('#measure button').forEach(function (b) { b.onclick = function () { S.m = b.dataset.m; document.querySelectorAll('#measure button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); render(); }; });
    var yr = $('#yr');
    if (yr) yr.oninput = function () { S.yr = +yr.value; S.sel = null; $('#yrv').textContent = S.yr; yr.setAttribute('aria-valuetext', 'First appearance up to ' + S.yr); render(); };
    $('#moreBtn').onclick = function () { S.all = !S.all; render(); };
    $('#cclose').onclick = function () { var d = $('#card'); d.close ? d.close() : d.removeAttribute('open'); };
    $('#card').addEventListener('click', function (e) { if (e.target === this) this.close(); });
  }
  initMap(); bind(); render();
})();
