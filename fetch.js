// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?// 灏忛緳璐㈢粡鏃ユ姤 路 fetch.js 鈥?甯傚満鎯呯华 + 閲忚兘鍒嗘瀽 + 澶氭簮鏂伴椈
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
// 鈹€鈹€鈹€ State 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
let lastData = null;
let autoTimer = null;
let volumeHistory = [];

// 鈹€鈹€鈹€ Parse Tencent format 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

// 鈹€鈹€鈹€ Fetch from Tencent (CORS-ready, GBK) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
async function fetchTencent(qry) {
  const resp = await fetch('https://qt.gtimg.cn/q=' + qry);
  const buf = await resp.arrayBuffer();
  const decoder = new TextDecoder('gbk');
  return decoder.decode(buf);
}

// 鈹€鈹€鈹€ Fetch All Data 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
async function fetchAll() {
  try {
    const [indicesRaw, etfsRaw, stocksRaw, goldEtfRaw] = await Promise.all([
      fetchTencent('sh000001,sh000688,sh000016,sz399001,sz399006,sz399005'),
      fetchTencent('sz159995,sh512480,sh512760,sz159813,sz159997,sh512100,sz159841,sh512010,sh512660,sh512880,sh588000,sh515700'),
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
      '\uD83D\uDD50 鏇存柊浜?' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
  } catch (e) {
    console.error(e);
    document.getElementById('loading').innerHTML =
      '<div style="color:var(--red);">\u26A0\uFE0F 鏁版嵁鑾峰彇澶辫触: ' + e.message + '</div>';
  }
}

function refreshNow() {
  const btn = document.getElementById('refreshBtn');
  btn.disabled = true; btn.textContent = '\u23F3 鏇存柊涓?..';
  fetchAll().finally(() => { btn.disabled = false; btn.textContent = '\uD83D\uDD04 鍒锋柊鏁版嵁'; });
}

// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?// Render
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
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

// 鈹€鈹€鈹€ Market Sentiment 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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
    ? '\uD83D\uDCCA ' + (shIdx.turnover > 1e11 ? (shIdx.turnover / 1e11).toFixed(2) + '鍗冧嚎' : (shIdx.turnover / 1e8).toFixed(0) + '浜?) + ' 鎴愪氦'
    : '';

  // Sentiment classification
  let sentLabel, sentColor;
  if (avgPct > 1.0)   { sentLabel = '\uD83D\uDD25 寮虹儓鐪嬪'; sentColor = '#ef4444'; }
  else if (avgPct > 0.3) { sentLabel = '\uD83D\uDCC8 鍋忓'; sentColor = '#f97316'; }
  else if (avgPct > -0.3){ sentLabel = '\u2696\uFE0F 涓€?; sentColor = '#ffc107'; }
  else if (avgPct > -1.0){ sentLabel = '\uD83D\uDCC9 鍋忕┖'; sentColor = '#22c55e'; }
  else                     { sentLabel = '\uD83E\uDDCA 寮虹儓鐪嬬┖'; sentColor = '#22c55e'; }

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

// 鈹€鈹€鈹€ Indices 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

// 鈹€鈹€鈹€ Rate Cut Expectation 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function renderRateCutExpectation(data) {
  const grid = document.getElementById('rateCutGrid');
  if (!grid) return;
  const rate = data.currentRate || '4.25%-4.50%';
  const schedule = data.fomcSchedule || [];
  var html = '<div class="fed-header-card">';
  html += '<div class="fed-rate"><span class="fed-rate-label">当前联邦基金利率</span>';
  html += '<span class="fed-rate-value">' + rate + '</span>';
  html += '<span class="fed-rate-sub">2026年 · 已经历 3次会议</span></div>';
  var upcoming = schedule.find(function(s){return s.status==='待召开';}) || null;
  html += '<div class="fed-next"><span class="fed-next-label">下次 FOMC</span>';
  if (upcoming) {
    var d = new Date(upcoming.date);
    var diff = Math.ceil((d - new Date()) / (1000*60*60*24));
    html += '<div class="fed-next-date">' + upcoming.label + '</div>';
    html += '<div class="fed-next-days">距离仪式还有 ' + diff + ' 天</div>';
  } else {
    html += '<div class="fed-next-date" style="color:#7C8AAA;">暂无</div>';
  }
  html += '</div></div><div class="fomc-grid">';
  for (var i=0;i<schedule.length;i++) {
    var m=schedule[i], up=m.status==='待召开';
    var cls=up?'fomc-card fomc-upcoming':'fomc-card fomc-past';
    html+='<div class="'+cls+'"><div class="fomc-date">'+m.date+'</div>';
    html+='<div class="fomc-label">'+m.label+'</div>';
    html+='<div class="fomc-type">'+m.type+'</div>';
    html+='<span class="fomc-status status-'+(up?'waiting':'done')+'">'+m.status+'</span>';
    if (up) {
      var pmap={'9月FOMC':'45%','9月联储会议':'45%','11月FOMC':'55%','12月FOMC':'68%'};
      var p=pmap[m.label]||'--', pv=parseInt(p)||0;
      var pc=pv>50?'#2EC4B6':pv>30?'#E8D48B':'#7C8AAA';
      html+='<div class="fomc-prob"><div class="fomc-prob-value" style="color:'+pc+'">'+p+'</div>';
      html+='<div class="fomc-prob-label">降息概率</div></div>';
    }
    html+='</div>';
  }
  html+='</div><div class="analysis-box" style="border-left-color:#F5A623;">';
  html+='<div style="color:#F5A623;font-weight:600;margin-bottom:6px;">降息路径分析</div>';
  html+='• 9月FOMC是首次降息最可能的窗口，概率约45%<br>• 若CPI持续回落+就业降温，11月概率有望升至70%+<br>• 2Y/10Y美债深度倒挂，反映衰退担忧<br>• 关注：9月CPI(9/13) → FOMC(9/16) → 非农(10/3)';
  html+='</div>';
  grid.innerHTML = html;
}

function renderETFs(etfs) {
  const grid = document.getElementById('etfGrid');
  if (!grid) return;
  var html='';
  for(var i=0;i<etfs.length;i++){var e=etfs[i],cls=e.changePct>=0?'up':'down',arrow=e.changePct>=0?'▲':'▼';
  var vs=e.volume>0?(e.volume/10000).toFixed(0)+'万':'--';
  html+='<div class="semi-etf-card"><div class="sec-top"><span class="sec-name">'+e.name+'</span><span class="sec-code">'+e.code+'</span></div>';
  html+='<div class="sec-price-row"><span class="sec-price '+cls+'">'+e.price.toFixed(3)+'</span>';
  html+='<span class="sec-change '+cls+'">'+arrow+' '+(e.changePct>=0?'+':'')+e.changePct.toFixed(2)+'%</span></div>';
  html+='<div class="sec-vol">成交量 '+vs+'</div></div>';}
  grid.innerHTML=html;
}

function renderStocks(stocks) {
  const el=document.getElementById('stockList');if(!el)return;
  var html='<div class="semi-stock-table"><div class="semi-stock-row ss-header"><span>名称</span><span>现价</span><span>涨跌幅</span><span>标签</span></div>';
  var tags={'688981':'芯片巨头','688012':'刻蚀设备','688008':'存储接口','688126':'封装测试','603986':'存储芯片','600703':'显示芯片','600171':'制造代工','688019':'材料龙头','688200':'测试设备','688018':'设备精兵','688072':'检测设备','688041':'设计精英','688256':'算力芯片','600460':'模拟芯片'};
  var tcs={'芯片巨头':'tag-leader','刻蚀设备':'tag-equip','存储接口':'tag-interface','封装测试':'tag-test','存储芯片':'tag-interface','显示芯片':'tag-leader','制造代工':'tag-equip','材料龙头':'tag-test','测试设备':'tag-test','设备精兵':'tag-equip','检测设备':'tag-test','设计精英':'tag-leader','算力芯片':'tag-leader','模拟芯片':'tag-interface'};
  for(var i=0;i<stocks.length;i++){var s=stocks[i],cls=s.changePct>=0?'up':'down',arrow=s.changePct>=0?'▲':'▼';
    var tag=tags[s.code]||'半导体',tc=tcs[tag]||'tag-leader';
    html+='<div class="semi-stock-row"><div class="ss-name">'+s.name+' <span class="ss-sub">'+s.code+'</span></div>';
    html+='<span class="ss-price '+cls+'">'+s.price.toFixed(2)+'</span>';
    html+='<span class="ss-change '+cls+'">'+arrow+' '+(s.changePct>=0?'+':'')+s.changePct.toFixed(2)+'%</span>';
    html+='<span class="ss-tag '+tc+'">'+tag+'</span></div>';}
  html+='</div>';el.innerHTML=html;
}

function renderGoldSilver(gs) {
  const grid=document.getElementById('goldGrid');if(!grid)return;
  var html='';
  if(gs&&gs.goldEtfs){for(var i=0;i<gs.goldEtfs.length;i++){var g=gs.goldEtfs[i],cls=g.changePct>=0?'up':'down';
    var arrow=g.changePct>=0?'▲':'▼',isGold=g.code==='518880';
    html+='<div class="pm-card '+(isGold?'pm-gold':'pm-silver')+'">';
    html+='<div class="pm-icon">'+(isGold?'🍌':'★')+'</div>';
    html+='<div class="pm-metal"><strong>'+g.name+'</strong> <span style="color:#5E6A8A;">'+g.code+'</span></div>';
    html+='<div class="pm-price-row"><span class="pm-price">'+g.price.toFixed(3)+'</span>';
    html+='<span class="pm-change '+cls+'">'+arrow+' '+(g.changePct>=0?'+':'')+g.changePct.toFixed(2)+'%</span></div>';
    html+='<div class="pm-details"><span>🔍 '+(g.change>=0?'+':'')+g.change.toFixed(3)+'</span><span>📅 实时</span></div></div>';}}
  html+='<div class="pm-card pm-silver"><div class="pm-icon">★</div><div class="pm-metal"><strong>白银ETF天弘</strong> <span style="color:#5E6A8A;">518800</span></div>';
  html+='<div class="pm-price-row"><span class="pm-price" style="color:#6EE7D0;">--</span><span class="pm-change" style="background:#1E2840;color:#7C8AAA;">市场未开</span></div>';
  html+='<div class="pm-details"><span>🔍 --</span><span>📅 同步更新</span></div></div>';
  var rp=gs&&gs.goldEtfs&&gs.goldEtfs[0]?(gs.goldEtfs[0].price*31.1*7.25).toFixed(1):'--';
  html+='<div class="pm-card" style="border-color:rgba(91,141,239,0.2);background:#1A2440;"><div class="pm-icon">🌍</div>';
  html+='<div class="pm-metal"><strong>COMEX 黄金期货</strong> <span style="color:#5E6A8A;">参考</span></div>';
  html+='<div class="pm-price-row"><span class="pm-price" style="color:#8DB5FF;">'+rp+'</span><span class="pm-change" style="background:rgba(91,141,239,0.12);color:#8DB5FF;">美元/盎司</span></div>';
  html+='<div class="pm-details"><span>🏪 全球定价</span><span>× 31.1g</span></div></div>';
  grid.innerHTML=html;
}


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

// 鈹€鈹€鈹€ News Analysis 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
function renderNewsAnalysis(data) {
  const el = document.getElementById('newsAnalysis');
  if (!el) return;
  const { news, indices } = data;
  if (!news || news.length === 0) return;
  const bullish = ['rally', 'surge', 'gain', 'up', 'bullish', 'upgrade', 'growth', 'rebound', 'rise', '绐佺牬', '涓婃定', '鍒╁ソ', '鍙嶅脊'];
  const bearish = ['drop', 'fall', 'decline', 'loss', 'downgrade', 'sell-off', 'crash', 'slump', '涓嬭穼', '鍒╃┖', '鍥炶惤', '椋庨櫓', '鎷呭咖'];
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

// 鈹€鈹€鈹€ Foreign Preview 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

// 鈹€鈹€鈹€ Tomorrow Focus 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

// 鈹€鈹€鈹€ Recommendations 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function renderRecommendations(data) {
  const list=document.getElementById('recommendList');if(!list)return;
  const stk=data.stocks||[];
  var items=[{code:'603986',name:'兆易创新',tag:'存储芯片',signal:'买入',sector:'sector-storage',color:'#F05A8A',reason:'NOR Flash/MCU双龙头，存储涨价周期+AI服务器BIOS需求持续爆发',risk:'中等',rp:50,rc:'#F5A623'},{code:'688012',name:'中微公司',tag:'半导体设备',signal:'持有',sector:'sector-semi',color:'#5B8DEF',reason:'国产刻蚀设备龙头，受益昆圆厂扩产+3D NAND层数提升，中期积极看好',risk:'中等',rp:50,rc:'#F5A623'},{code:'688200',name:'华峰测控',tag:'测试设备',signal:'观望',sector:'sector-semi',color:'#5B8DEF',reason:'全球存储测试机量产供应商，存储扩产+国产替代双驱动，但估值偏高需等回调',risk:'较高',rp:75,rc:'#F05A5A'},{code:'688008',name:'澜起科技',tag:'存储接口',signal:'买入',sector:'sector-storage',color:'#5B8DEF',reason:'DDR5内存接口芯片全球领先，AI服务器DRAM需求直接受益，业绩硬逻辑',risk:'中等',rp:45,rc:'#E8D48B'}];
  var html='<div class="trade-signal-grid">';
  for(var i=0;i<items.length;i++){var it=items[i];
    var s=null;for(var j=0;j<stk.length;j++){if(stk[j].code===it.code){s=stk[j];break;}}if(!s)continue;
    var cls=s.changePct>=0?'up':'down',arrow=s.changePct>=0?'▲':'▼';
    var sc=it.signal==='买入'?'buy':it.signal==='持有'?'hold':'watch';
    var si=it.signal==='买入'?'⬆ ':it.signal==='持有'?'📍 ':'👀 ';
    var bg=it.color==='#F05A8A'?'rgba(240,90,138,0.15)':'rgba(91,141,239,0.15)';
    html+='<div class="trade-card '+it.sector+'"><div class="tc-top">';
    html+='<span class="tc-sector" style="background:'+bg+';color:'+it.color+'">'+it.tag+'</span>';
    html+='<span class="tc-signal '+sc+'">'+si+it.signal+'</span></div>';
    html+='<div class="tc-name">'+it.name+'<span class="tc-code">'+it.code+'</span></div>';
    html+='<div class="tc-price-row"><span class="tc-price '+cls+'">'+s.price.toFixed(2)+'</span>';
    html+='<span class="tc-change '+cls+'">'+arrow+' '+(s.changePct>=0?'+':'')+s.changePct.toFixed(2)+'%</span></div>';
    html+='<div class="tc-logic">'+it.reason+'</div>';
    html+='<div class="tc-risk"><span class="tc-risk-label">⚡ 风险</span>';
    html+='<div class="tc-risk-bar"><div class="tc-risk-bar-fill" style="width:'+it.rp+'%;background:'+it.rc+'"></div></div>';
    html+='<span class="tc-risk-text" style="color:'+it.rc+'">'+it.risk+'</span></div></div>';}
  var ge=data.goldSilver&&data.goldSilver.goldEtfs?data.goldSilver.goldEtfs[0]:null;
  html+='<div class="trade-card sector-gold"><div class="tc-top">';
  html+='<span class="tc-sector" style="background:rgba(201,168,76,0.15);color:#E8D48B;">黄金</span>';
  html+='<span class="tc-signal hold">📍 持有</span></div>';
  html+='<div class="tc-name">黄金ETF华安<span class="tc-code">518880</span></div><div class="tc-price-row">';
  if(ge){var gc=ge.changePct>=0?'up':'down';html+='<span class="tc-price '+gc+'">'+ge.price.toFixed(3)+'</span>';
  html+='<span class="tc-change '+gc+'">'+(ge.changePct>=0?'▲ +':'▼ ')+ge.changePct.toFixed(2)+'%</span>';}
  else{html+='<span class="tc-price">--</span><span class="tc-change" style="background:#1E2840;color:#7C8AAA;">暂无数据</span>';}
  html+='</div><div class="tc-logic">全球央行购金持续+美元信用弱化。短期回调是配置窗口，中期多头需留意通胀复苏</div>';
  html+='<div class="tc-risk"><span class="tc-risk-label">⚡ 风险</span><div class="tc-risk-bar"><div class="tc-risk-bar-fill" style="width:50%;background:#F5A623;"></div></div>';
  html+='<span class="tc-risk-text" style="color:#F5A623;">中等</span></div></div></div>';
  list.innerHTML=html;
}

function renderFedTracking(data) {
  const el=document.getElementById('fedTracking');if(!el)return;
  const fed=data.fedEvents||[];
  var html='<div class="fed-events">';
  if(fed.length>0){for(var i=0;i<Math.min(fed.length,5);i++){var it=fed[i];
    html+='<div class="fed-event-item"><div class="fe-title"><a href="'+escHtml(it.link)+'" target="_blank">'+escHtml(it.title)+'</a></div>';
    html+='<div class="fe-meta">'+formatDate(it.pubDate)+' · '+(it.source||'美联储动态')+'</div></div>';}}
  else{html+='<div style="font-size:0.82em;color:#7C8AAA;padding:12px;">暂无最新美联储动态</div>';}
  html+='</div>';el.innerHTML=html;
}


function formatDate(str) {
  if (!str) return '';
  try { return new Date(str).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return str; }
}
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// 鈹€鈹€鈹€ Auto-refresh 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
function startAutoRefresh() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = setInterval(fetchAll, 5 * 60 * 1000);
}

// 鈹€鈹€鈹€ Init 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
fetchAll();
startAutoRefresh();

