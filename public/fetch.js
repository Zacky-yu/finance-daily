// ═══════════════════════════════════════════════════════════════════════════════
// 小龙财经日报 · fetch.js — 市场情绪 + 量能分析 + 多源新闻
// ═══════════════════════════════════════════════════════════════════════════════

// ─── State ──────────────────────────────────────────────────────────────────
let lastData = null;
let autoTimer = null;
let volumeHistory = [];

// ─── Parse Tencent format ────────────────────────────────────────────────────
function parseTencentLine(line, expectedFields) {
  const m = line.match(/v_[^=]+="([^"]+)"/);
  if (!m) return null;
  const parts = m[1].split('~');
  const item = {};
  for (const [key, idx] of Object.entries(expectedFields)) {
    item[key] = parts[idx] || '';
  }
  return item;
}

// ─── Fetch from Tencent (CORS-ready, GBK) ────────────────────────────────────
async function fetchTencent(qry) {
  const resp = await fetch('https://qt.gtimg.cn/q=' + qry);
  const buf = await resp.arrayBuffer();
  const decoder = new TextDecoder('gbk');
  return decoder.decode(buf);
}

// ─── Fetch All Data ──────────────────────────────────────────────────────────
async function fetchAll() {
  try {
    const [indicesRaw, etfsRaw, stocksRaw, goldEtfRaw] = await Promise.all([
      fetchTencent('sh000001,sh000688,sh000016,sz399001,sz399006,sz399005'),
      fetchTencent('sz159995,sh512480,sh512760,sz159813,sz159997,sh512100,sz159841'),
      fetchTencent('sh688981,sh688012,sh688008,sh688126,sh603986,sh600703,sh600171,sh688019,sh688200,sh688018,sh688072,sh688041,sh688256,sh600460'),
      fetchTencent('sh518880,sh518800'),
    ]);

    // Try to fetch cached news  
    let newsData = null;
    try {
      const newsResp = await fetch('./news-cache.json');
      if (newsResp.ok) newsData = await newsResp.json();
    } catch(e) { /* ignore */ }

    // Parse indices (with volume)
    const indices = indicesRaw.split('\n').filter(Boolean).map(line => {
      const p = parseTencentLine(line, { name: 1, code: 2, price: 3, change: 31, changePct: 32, high: 33, low: 34, open: 5, volume: 6, turnover: 7 });
      return p ? { name: p.name, code: p.code, price: parseFloat(p.price) || 0, change: parseFloat(p.change) || 0, changePct: parseFloat(p.changePct) || 0, high: parseFloat(p.high) || 0, low: parseFloat(p.low) || 0, open: parseFloat(p.open) || 0, volume: parseFloat(p.volume) || 0, turnover: parseFloat(p.turnover) || 0 } : null;
    }).filter(Boolean);

    // Track volume history for comparison
    const shIdx = indices.find(i => i.code === '000001');
    if (shIdx && shIdx.volume > 0) {
      volumeHistory.push({ time: Date.now(), volume: shIdx.volume, turnover: shIdx.turnover });
      if (volumeHistory.length > 20) volumeHistory.shift();
    }

    // Parse ETFs (with volume)
    const etfs = etfsRaw.split('\n').filter(Boolean).map(line => {
      const p = parseTencentLine(line, { name: 1, code: 2, price: 3, change: 31, changePct: 32, volume: 6 });
      return p ? { name: p.name, code: p.code, price: parseFloat(p.price) || 0, change: parseFloat(p.change) || 0, changePct: parseFloat(p.changePct) || 0, volume: parseFloat(p.volume) || 0 } : null;
    }).filter(Boolean);

    // Parse stocks
    const stocks = stocksRaw.split('\n').filter(Boolean).map(line => {
      const p = parseTencentLine(line, { name: 1, code: 2, price: 3, change: 31, changePct: 32, high: 33, low: 34, open: 5 });
      return p ? { name: p.name, code: p.code, price: parseFloat(p.price) || 0, changePct: parseFloat(p.changePct) || 0, change: parseFloat(p.change) || 0, high: parseFloat(p.high) || 0, low: parseFloat(p.low) || 0, open: parseFloat(p.open) || 0 } : null;
    }).filter(Boolean);

    // Parse gold ETFs
    const goldEtfs = goldEtfRaw.split('\n').filter(Boolean).map(line => {
      const p = parseTencentLine(line, { name: 1, code: 2, price: 3, change: 31, changePct: 32 });
      return p ? { name: p.name, code: p.code, price: parseFloat(p.price) || 0, change: parseFloat(p.change) || 0, changePct: parseFloat(p.changePct) || 0 } : null;
    }).filter(Boolean);

    // Parse news from cache
    let news = [], fedEvents = [];
    if (newsData && newsData.items) {
      for (const item of newsData.items) {
        if (item.source === 'FED') fedEvents.push(item);
        else news.push(item);
      }
    }

    const data = { indices, stocks, etfs, goldSilver: { goldEtfs }, news, fedEvents };
    lastData = data;
    render(data);

    document.getElementById('updateTime').textContent =
      '\uD83D\uDD50 更新于 ' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
  } catch (e) {
    console.error(e);
    document.getElementById('loading').innerHTML =
      '<div style="color:var(--red);">\u26A0\uFE0F 数据获取失败: ' + e.message + '</div>';
  }
}

function refreshNow() {
  const btn = document.getElementById('refreshBtn');
  btn.disabled = true; btn.textContent = '\u23F3 更新中...';
  fetchAll().finally(() => { btn.disabled = false; btn.textContent = '\uD83D\uDD04 刷新数据'; });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Render
// ═══════════════════════════════════════════════════════════════════════════════

function render(data) {
  renderIndices(data.indices);
  renderSentiment(data);
  renderRateCutExpectation(data);
  renderETFs(data.etfs);
  renderStocks(data.stocks);
  renderGoldSilver(data.goldSilver);
  renderNews(data.news);
  renderNewsAnalysis(data);
  renderForeignPreview(data);
  renderTomorrowFocus(data);
  renderRecommendations(data);
  renderFedTracking(data);
}

// ─── Market Sentiment ────────────────────────────────────────────────────────
function renderSentiment(data) {
  const el = document.getElementById('sentimentPanel');
  if (!el) return;
  const { indices, etfs } = data;

  // Composite index score
  let score = 0, count = 0;
  for (const idx of indices) {
    if (idx.changePct !== undefined) { score += idx.changePct; count++; }
  }
  const avgPct = count > 0 ? score / count : 0;

  // Volume analysis
  const shIdx = indices.find(i => i.code === '000001');
  const volumeInfo = shIdx && shIdx.volume > 0
    ? '\uD83D\uDCCA ' + (shIdx.turnover > 1e11 ? (shIdx.turnover / 1e11).toFixed(2) + '千亿' : (shIdx.turnover / 1e8).toFixed(0) + '亿') + ' 成交'
    : '';

  // Sentiment classification
  let sentLabel, sentColor;
  if (avgPct > 1.0)   { sentLabel = '\uD83D\uDD25 强烈看多'; sentColor = '#ef4444'; }
  else if (avgPct > 0.3) { sentLabel = '\uD83D\uDCC8 偏多'; sentColor = '#f97316'; }
  else if (avgPct > -0.3){ sentLabel = '\u2696\uFE0F 中性'; sentColor = '#ffc107'; }
  else if (avgPct > -1.0){ sentLabel = '\uD83D\uDCC9 偏空'; sentColor = '#22c55e'; }
  else                     { sentLabel = '\uD83E\uDDCA 强烈看空'; sentColor = '#22c55e'; }

  // Sector heat  
  const sectorMap = [
    { name: '\u534A\u5BFC\u4F53',     etf: etfs.find(e => e.code === '159995'), color: '#f472b6' },
    { name: '\u533B\u836F',           etf: etfs.find(e => e.code === '512010'), color: '#42a5f5' },
    { name: '\u65B0\u80FD\u6E90',    etf: etfs.find(e => e.code === '515700'), color: '#4fd1c5' },
    { name: '\u519B\u5DE5',           etf: etfs.find(e => e.code === '512660'), color: '#ff9800' },
    { name: '\u8BC1\u5238',           etf: etfs.find(e => e.code === '512880'), color: '#ef4444' },
    { name: '\u79D1\u521B50',         etf: etfs.find(e => e.code === '588000'), color: '#ab47bc' },
  ];

  let sectorHtml = '';
  for (const s of sectorMap) {
    if (s.etf) {
      const pct = s.etf.changePct;
      const cls = pct >= 0 ? 'up' : 'down';
      sectorHtml += '<span class="card" style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;margin:2px;font-size:0.78em;">';
      sectorHtml += '<span style="color:' + s.color + ';">' + s.name + '</span>';
      sectorHtml += '<span class="' + cls + '">' + (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%</span></span>';
    }
  }

  let html = '<div class="grid-4" style="margin-bottom:0;">';
  html += '<div class="card" style="grid-column:span 2;">';
  html += '  <div class="label">\u5E02\u573A\u60C5\u7EEA</div>';
  html += '  <div style="font-size:1.5em;font-weight:700;color:' + sentColor + ';">' + sentLabel + '</div>';
  html += '  <div class="sub" style="color:var(--text-dim);">\u7EFC\u5408\u6307\u6570: ' + (avgPct >= 0 ? '+' : '') + avgPct.toFixed(2) + '%</div>';
  if (volumeInfo) html += '  <div class="sub" style="color:var(--text-muted);font-size:0.78em;">' + volumeInfo + '</div>';
  html += '</div>';
  html += '<div class="card" style="grid-column:span 2;">';
  html += '  <div class="label">\u677F\u5757\u70ED\u5EA6</div>';
  html += '  <div style="margin-top:4px;line-height:1.8;">' + sectorHtml + '</div>';
  html += '</div></div>';
  el.innerHTML = html;
}

// ─── Indices ─────────────────────────────────────────────────────────────────
function renderIndices(indices) {
  const grid = document.getElementById('indexGrid');
  if (!grid) return;
  let html = '';
  for (const idx of indices) {
    const cls = idx.changePct >= 0 ? 'up' : idx.changePct < 0 ? 'down' : 'flat';
    html += '<div class="card"><div class="label">' + idx.name + '</div>';
    html += '<div class="value ' + cls + '">' + idx.price.toFixed(2) + '</div>';
    html += '<div class="sub ' + cls + '">' + (idx.changePct >= 0 ? '+' : '') + idx.changePct.toFixed(2) + '%</div></div>';
  }
  grid.innerHTML = html;
}

// ─── Rate Cut Expectation ────────────────────────────────────────────────────
function renderRateCutExpectation(data) {
  const grid = document.getElementById('rateCutGrid');
  if (!grid) return;
  const rateMeetings = [
    { date: '9\u670816\u65E5', label: '9\u6708FOMC', prob: '45%', desc: '\uD83D\uDD0D \u5E02\u573A\u7126\u70B9' },
    { date: '11\u67084\u65E5', label: '11\u6708FOMC', prob: '55%', desc: '\u5927\u9009\u524D\u5173\u6CE8' },
    { date: '12\u670815\u65E5', label: '12\u6708FOMC', prob: '68%', desc: '\u5E74\u672B\u964D\u606F\u9884\u671F' },
  ];
  let html = '<div class="card"><div class="label">\u5F53\u524D\u8054\u90A6\u57FA\u91D1\u5229\u7387</div>';
  html += '<div class="value" style="color:var(--orange);font-size:1.2em;">4.25%-4.50%</div>';
  html += '<div class="sub" style="color:var(--text-dim);">2026\u5E74\u66F4\u65B0</div></div>';
  for (const m of rateMeetings) {
    const color = parseInt(m.prob) > 50 ? 'var(--green)' : parseInt(m.prob) > 30 ? 'var(--gold)' : 'var(--text-muted)';
    html += '<div class="card"><div class="label">' + m.label + ' <span style="font-size:0.8em;color:var(--text-dim);">' + m.date + '</span></div>';
    html += '<div class="value" style="color:' + color + ';">' + m.prob + '</div>';
    html += '<div class="sub" style="color:var(--text-dim);">' + m.desc + '</div></div>';
  }
  grid.innerHTML = html;
  const analysis = document.getElementById('rateCutAnalysis');
  if (analysis) {
    analysis.innerHTML = '<div style="font-size:0.85em;"><span style="color:var(--accent);font-weight:600;">\u964D\u606F\u8DEF\u5F84\u5206\u6790</span><br><br>\u2022 9\u6708FOMC\u662F\u9996\u6B21\u964D\u606F\u6700\u53EF\u80FD\u7684\u7A97\u53E3\uFF0C\u6982\u7387\u7EA645%<br>\u2022 \u82E5CPI\u6301\u7EED\u56DE\u843D+\u5C31\u4E1A\u964D\u6E29\uFF0C11\u6708\u6982\u7387\u6709\u671B\u5347\u81F370%+<br>\u2022 2Y/10Y\u7F8E\u503A\u6DF1\u5EA6\u5012\u6302\uFF0C\u53CD\u6620\u8870\u9000\u62C5\u5FE7<br>\u2022 \u5173\u6CE8\uFF1A9\u6708CPI(9/13) \u2192 FOMC(9/16) \u2192 \u975E\u519C(10/3)<br></div>';
  }
}

// ─── ETFs ─────────────────────────────────────────────────────────────────────
function renderETFs(etfs) {
  const grid = document.getElementById('etfGrid');
  if (!grid) return;
  let html = '';
  for (const etf of etfs) {
    const cls = etf.changePct >= 0 ? 'up' : 'down';
    html += '<div class="card"><div class="label">' + etf.name + ' <span style="font-size:0.7em;color:var(--text-dim);">' + etf.code + '</span></div>';
    html += '<div class="value ' + cls + '">' + etf.price.toFixed(3) + '</div>';
    html += '<div class="sub ' + cls + '">' + (etf.changePct >= 0 ? '+' : '') + etf.changePct.toFixed(2) + '%</div></div>';
  }
  grid.innerHTML = html;
}

// ─── Stocks ──────────────────────────────────────────────────────────────────
function renderStocks(stocks) {
  const el = document.getElementById('stockList');
  if (!el) return;
  let html = '<div class="stock-table"><div class="stock-row header-row"><span>\u540D\u79F0</span><span>\u73B0\u4EF7</span><span>\u6DA8\u8DCC\u5E45</span><span>\u6DA8\u8DCC\u989D</span></div>';
  for (const s of stocks) {
    const cls = s.changePct >= 0 ? 'up' : 'down';
    html += '<div class="stock-row"><span class="name">' + s.name + ' <span class="code">' + s.code + '</span></span>';
    html += '<span class="' + cls + '">' + s.price.toFixed(2) + '</span>';
    html += '<span class="' + cls + '">' + (s.changePct >= 0 ? '+' : '') + s.changePct.toFixed(2) + '%</span>';
    html += '<span class="' + cls + '">' + (s.change >= 0 ? '+' : '') + s.change.toFixed(2) + '</span></div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

// ─── Gold ─────────────────────────────────────────────────────────────────────
function renderGoldSilver(gs) {
  const grid = document.getElementById('goldGrid');
  if (!grid) return;
  let html = '';
  if (gs.goldEtfs) {
    for (const g of gs.goldEtfs) {
      const cls = g.changePct >= 0 ? 'up' : 'down';
      html += '<div class="card"><div class="label">' + g.name + ' <span style="font-size:0.7em;color:var(--text-dim);">' + g.code + '</span></div>';
      html += '<div class="value ' + cls + '">' + g.price.toFixed(3) + '</div>';
      html += '<div class="sub ' + cls + '">' + (g.changePct >= 0 ? '+' : '') + g.changePct.toFixed(2) + '%</div></div>';
    }
  }
  grid.innerHTML = html;
}

// ─── News ─────────────────────────────────────────────────────────────────────
function renderNews(news) {
  const list = document.getElementById('newsList');
  if (!list) return;
  let html = '';
  if (!news || news.length === 0) {
    html = '<div class="news-item"><span style="color:var(--text-muted);">\u6682\u65E0\u65B0\u95FB\u6570\u636E\uFF0CGitHub Actions \u672A\u8FD0\u884C\u6216\u7F13\u5B58\u5C1A\u672A\u751F\u6210</span></div>';
  } else {
    for (const item of news.slice(0, 10)) {
      const tagColor = item.source === 'US' ? 'tag-market' : 'tag-hot';
      html += '<div class="news-item"><div class="news-title"><a href="' + escHtml(item.link) + '" target="_blank">' + escHtml(item.title) + '</a></div>';
      html += '<div class="news-meta"><span class="card-tag ' + tagColor + '">' + (item.source || '\u5168\u7403') + '</span>';
      html += '<span>' + formatDate(item.pubDate) + '</span>';
      if (item.category) html += '<span style="color:var(--text-dim);">' + item.category + '</span>';
      html += '</div>';
      if (item.content) html += '<div class="news-desc">' + escHtml(item.content.substring(0, 200)) + '</div>';
      html += '</div>';
    }
  }
  list.innerHTML = html;
}

// ─── News Analysis ───────────────────────────────────────────────────────────
function renderNewsAnalysis(data) {
  const el = document.getElementById('newsAnalysis');
  if (!el) return;
  const { news, indices } = data;
  if (!news || news.length === 0) return;
  const bullish = ['rally', 'surge', 'gain', 'up', 'bullish', 'upgrade', 'growth', 'rebound', 'rise', '突破', '上涨', '利好', '反弹'];
  const bearish = ['drop', 'fall', 'decline', 'loss', 'downgrade', 'sell-off', 'crash', 'slump', '下跌', '利空', '回落', '风险', '担忧'];
  let bullCount = 0, bearCount = 0;
  for (const item of news) {
    const title = (item.title || '').toLowerCase();
    for (const w of bullish) { if (title.includes(w)) { bullCount++; break; } }
    for (const w of bearish) { if (title.includes(w)) { bearCount++; break; } }
  }
  const total = bullCount + bearCount || 1;
  const ratio = (bullCount / total * 100).toFixed(0);
  let summary = '';
  if (ratio > 60) summary = '\uD83D\uDCF0 \u6D88\u606F\u9762\u504F\u79EF\u6781\uFF0C\u5229\u597D\u65B0\u95FB\u5360\u6BD4 ' + ratio + '%';
  else if (ratio > 40) summary = '\uD83D\uDCF0 \u6D88\u606F\u9762\u4E2D\u6027\uFF0C\u591A\u7A7A\u4EA4\u7EC7';
  else summary = '\uD83D\uDCF0 \u6D88\u606F\u9762\u504F\u8C28\u614E\uFF0C\u5229\u7A7A\u65B0\u95FB\u5360\u6BD4 ' + (100 - parseInt(ratio)) + '%';
  const sh = indices.find(i => i.code === '000001');
  if (sh && Math.abs(sh.changePct) > 1) {
    summary += ' \u00B7 \u5927\u76D8' + (sh.changePct > 0 ? '\u5F3A\u52BF' : '\u5F31\u52BF') + ' (\u6DA8\u8DCC\u5E45 ' + (sh.changePct >= 0 ? '+' : '') + sh.changePct.toFixed(2) + '%)';
  }
  el.innerHTML = '<div style="font-size:0.85em;color:var(--text-muted);padding:8px 0;">' + summary + '</div>';
}

// ─── Foreign Preview ─────────────────────────────────────────────────────────
function renderForeignPreview(data) {
  const el = document.getElementById('foreignPreview');
  if (!el) return;
  const usNews = (data.news || []).filter(n => n.source === 'US').slice(0, 3);
  let html = '';
  if (usNews.length > 0) {
    html += '<div style="font-size:0.85em;"><div style="color:var(--text-muted);margin-bottom:6px;">\uD83C\uDDFA\uD83C\uDDF8 \u9694\u591C\u5E02\u573A\u5173\u6CE8</div>';
    for (const item of usNews) {
      html += '<div class="news-item" style="padding:8px 10px;"><div class="news-title" style="font-size:0.82em;"><a href="' + escHtml(item.link) + '" target="_blank">' + escHtml(item.title) + '</a></div>';
      html += '<div class="news-meta" style="font-size:0.72em;">' + formatDate(item.pubDate) + '</div></div>';
    }
    html += '</div>';
  } else {
    html = '<div style="font-size:0.82em;color:var(--text-dim);">\u6682\u65E0\u9694\u591C\u5E02\u573A\u6570\u636E</div>';
  }
  el.innerHTML = html;
}

// ─── Tomorrow Focus ──────────────────────────────────────────────────────────
function renderTomorrowFocus(data) {
  const el = document.getElementById('tomorrowFocus');
  if (!el) return;
  const { indices } = data;
  const sh = indices.find(i => i.code === '000001');
  const isUp = sh && sh.changePct > 0;
  let html = '<ul style="list-style:none;font-size:0.85em;padding:0;color:var(--text-muted);">';
  if (isUp) {
    html += '  <li style="padding:4px 0;">\u2022 \u4ECA\u65E5\u5E02\u573A\u53CD\u5F39\uFF0C\u5173\u6CE8\u660E\u65E5\u91CF\u80FD\u80FD\u5426\u7EE7\u7EED\u653E\u5927</li>';
    html += '  <li style="padding:4px 0;">\u2022 \u5317\u5411\u8D44\u91D1\u662F\u5426\u8FDE\u7EED\u51C0\u4E70\u5165\u4E3A\u5173\u952E\u4FE1\u53F7</li>';
  } else {
    html += '  <li style="padding:4px 0;">\u2022 \u4ECA\u65E5\u5E02\u573A\u56DE\u8C03\uFF0C\u5173\u6CE8\u652F\u6491\u4F4D\u80FD\u5426\u6709\u6548\u62B5\u5FA1</li>';
    html += '  <li style="padding:4px 0;">\u2022 \u663C\u591C\u7F8E\u80A1\u671F\u8D27\u8D70\u52BF\u5BF9\u660E\u65E5\u60C5\u7EEA\u5F71\u54CD\u91CD\u5927</li>';
  }
  html += '  <li style="padding:4px 0;">\u2022 \u96C6\u5408\u7ADE\u4EF7\u89C2\u5BDF\u60C5\u7EEA\u5EF6\u7EED\u6027</li>';
  html += '  <li style="padding:4px 0;">\u2022 \u91CD\u70B9\u5173\u6CE8\u534A\u5BFC\u4F53/\u9EC4\u91D1\u7B49\u6838\u5FC3\u8D5B\u9053\u8868\u73B0</li>';
  html += '</ul>';
  el.innerHTML = html;
}

// ─── Recommendations ────────────────────────────────────────────────────────
function renderRecommendations(data) {
  const list = document.getElementById('recommendList');
  if (!list) return;
  const stk = data.stocks || [];
  const names = {
    '603986': { name: '\u5146\u6613\u521B\u65B0', tag: '\u5B58\u50A8\u82AF\u7247', color: 'var(--pink)' },
    '688012': { name: '\u4E2D\u5FAE\u516C\u53F8', tag: '\u534A\u5BFC\u4F53\u8BBE\u5907', color: 'var(--accent)' },
    '688200': { name: '\u534E\u5CF0\u6D4B\u63A7', tag: '\u534A\u5BFC\u4F53\u8BBE\u5907', color: 'var(--accent)' },
    '688008': { name: '\u6F9C\u8D77\u79D1\u6280', tag: '\u5B58\u50A8\u63A5\u53E3', color: 'var(--accent)' },
  };
  const reasons = {
    '603986': 'NOR Flash/MCU\u53CC\u9F99\u5934\uFF0C\u5B58\u50A8\u6DA8\u4EF7\u5468\u671F+AI\u670D\u52A1\u5668BIOS\u9700\u6C42',
    '688012': '\u56FD\u4EA7\u523B\u8680\u8BBE\u5907\u9F99\u5934\uFF0C\u53D7\u76CA\u6606\u5706\u5382\u6269\u4EA7+3D NAND\u5C42\u6570\u63D0\u5347',
    '688200': '\u56FD\u5185\u552F\u4E00\u5B58\u50A8\u6D4B\u8BD5\u673A\u91CF\u4EA7\u4F9B\u5E94\u5546\u3002\u5B58\u50A8\u6269\u4EA7+\u56FD\u4EA7\u66FF\u4EE3\u53CC\u9A71\u52A8',
    '688008': 'DDR5\u5185\u5B58\u63A5\u53E3\u82AF\u7247\u5168\u7403\u9886\u5148\uFF0CAI\u670D\u52A1\u5668DRAM\u9700\u6C42\u76F4\u63A5\u53D7\u76CA',
  };
  let html = '';
  for (const [code, info] of Object.entries(names)) {
    const s = stk.find(x => x.code === code);
    if (s) {
      html += '<div class="recommend" style="border-left-color:' + info.color + ';">';
      html += '  <div class="r-tag">' + info.tag + '</div>';
      html += '  <div class="r-name">' + info.name + ' ' + code + ' <span class="' + (s.changePct >= 0 ? 'up' : 'down') + '">' + (s.changePct >= 0 ? '\u25B2' : '\u25BC') + ' ' + s.price.toFixed(2) + '</span></div>';
      html += '  <div class="r-reason"><strong>\u903B\u8F91\uFF1A</strong>' + reasons[code] + '。<br><span style="color:var(--orange);">\u26A1 \u98CE\u9669\uFF1A' + (code === '688200' ? '\u8F83\u9AD8' : '\u4E2D\u7B49') + '</span></div></div>';
    }
  }
  html += '<div class="recommend" style="border-left-color:var(--gold);">';
  html += '  <div class="r-tag" style="background:rgba(255,193,7,0.2);color:var(--gold);">\u9EC4\u91D1</div>';
  html += '  <div class="r-name">\u9EC4\u91D1ETF\u534E\u5B89 518880</div>';
  html += '  <div class="r-reason"><strong>\u903B\u8F91\uFF1A</strong>\u5168\u7403\u592E\u884C\u8D2D\u91D1\u6301\u7EED+\u7F8E\u5143\u4FE1\u7528\u5F31\u5316\u3002\u77ED\u671F\u91D1\u4EF7\u56DE\u8C03\u662F\u914D\u7F6E\u7A97\u53E3\u3002<br><span style="color:var(--orange);">\u26A1 \u98CE\u9669\uFF1A\u4E2D\u7B49</span></div></div>';
  if (!html) html = '<div class="news-item">\u6682\u65E0\u63A8\u8350\u6570\u636E</div>';
  list.innerHTML = html;
}

// ─── Fed Tracking ────────────────────────────────────────────────────────────
function renderFedTracking(data) {
  const el = document.getElementById('fedTracking');
  if (!el) return;
  const fed = data.fedEvents || [];
  let html = '';
  if (fed.length > 0) {
    for (const item of fed.slice(0, 5)) {
      html += '<div class="news-item" style="padding:8px 10px;"><div class="news-title" style="font-size:0.82em;"><a href="' + escHtml(item.link) + '" target="_blank">' + escHtml(item.title) + '</a></div>';
      html += '<div class="news-meta" style="font-size:0.72em;">' + formatDate(item.pubDate) + '</div></div>';
    }
  } else {
    html = '<div style="font-size:0.82em;color:var(--text-dim);">\u6682\u65E0\u6700\u65B0\u7F8E\u8054\u50A8\u52A8\u6001</div>';
  }
  el.innerHTML = html;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(str) {
  if (!str) return '';
  try { return new Date(str).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return str; }
}
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ─── Auto-refresh ────────────────────────────────────────────────────────────
function startAutoRefresh() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = setInterval(fetchAll, 5 * 60 * 1000);
}

// ─── Init ────────────────────────────────────────────────────────────────────
fetchAll();
startAutoRefresh();
