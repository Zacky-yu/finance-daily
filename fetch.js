// ═══════════════════════════════════════════════
// 小龙财经日报 · fetch.js — 市场行情 + 板块分析 + 多源新闻
// ═══════════════════════════════════════════════

let lastData = null;
let autoTimer = null;
let volumeHistory = [];
let spotPm = { gold: null, silver: null };

// ─── Parse Tencent ───
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

// ─── Parse Tencent hf_ (international forex/commodity) format ───
// Format: price,%change,open,high,low,time,prevClose,?,0,0,0,date,name
function parseHfLine(line) {
  const m = line.match(/v_[^=]+="([^"]+)"/);
  if (!m) return null;
  const parts = m[1].split(',');
  if (parts.length < 14) return null;
  return {
    price: parseFloat(parts[0]) || 0,
    changePct: parseFloat(parts[1]) || 0,
    open: parseFloat(parts[2]) || 0,
    high: parseFloat(parts[4]) || 0,
    low: parseFloat(parts[5]) || 0,
    time: parts[6],
    prevClose: parseFloat(parts[7]) || 0,
    date: parts[12] || '',
    name: parts[13] || '',
  };
}

// ─── Fetch from Tencent ───
async function fetchTencent(qry) {
  const resp = await fetch('https://qt.gtimg.cn/q=' + qry);
  const buf = await resp.arrayBuffer();
  const decoder = new TextDecoder('gbk');
  return decoder.decode(buf);
}

// ─── Fetch All Data ───
async function fetchAll() {
  try {
    const [indicesRaw, etfsRaw, stocksRaw, goldEtfRaw, spotRaw] = await Promise.all([
      fetchTencent('sh000001,sh000688,sh000016,sz399001,sz399006,sz399005'),
      fetchTencent('sz159995,sh512480,sh512760,sz159813,sz159997,sh512100,sz159841,sh512010,sh512660,sh512880,sh588000,sh515700'),
      fetchTencent('sh688981,sh688012,sh688008,sh688126,sh603986,sh600703,sh600171,sh688019,sh688200,sh688018,sh688072,sh688041,sh688256,sh600460'),
      fetchTencent('sh518880,sh518800'),
      fetchTencent('hf_XAU,hf_XAG'),
    ]);

    // Try news cache
    let newsData = null;
    try {
      const newsResp = await fetch('./news-cache.json');
      if (newsResp.ok) newsData = await newsResp.json();
    } catch(e) { /* ignore */ }

    // Parse indices
    const indices = indicesRaw.split('\n').filter(Boolean).map(line => {
      const p = parseTencentLine(line, { name: 1, code: 2, price: 3, change: 31, changePct: 32, high: 33, low: 34, open: 5, volume: 6, turnover: 7 });
      return p ? {
        name: p.name, code: p.code,
        price: parseFloat(p.price) || 0,
        change: parseFloat(p.change) || 0,
        changePct: parseFloat(p.changePct) || 0,
        high: parseFloat(p.high) || 0,
        low: parseFloat(p.low) || 0,
        open: parseFloat(p.open) || 0,
        volume: parseFloat(p.volume) || 0,
        turnover: parseFloat(p.turnover) || 0,
      } : null;
    }).filter(Boolean);

    // Volume history
    const shIdx = indices.find(i => i.code === '000001');
    if (shIdx && shIdx.volume > 0) {
      volumeHistory.push({ time: Date.now(), volume: shIdx.volume, turnover: shIdx.turnover });
      if (volumeHistory.length > 20) volumeHistory.shift();
    }

    // Parse ETFs
    const etfs = etfsRaw.split('\n').filter(Boolean).map(line => {
      const p = parseTencentLine(line, { name: 1, code: 2, price: 3, change: 31, changePct: 32, volume: 6 });
      return p ? {
        name: p.name, code: p.code,
        price: parseFloat(p.price) || 0,
        change: parseFloat(p.change) || 0,
        changePct: parseFloat(p.changePct) || 0,
        volume: parseFloat(p.volume) || 0,
      } : null;
    }).filter(Boolean);

    // Parse stocks
    const stocks = stocksRaw.split('\n').filter(Boolean).map(line => {
      const p = parseTencentLine(line, { name: 1, code: 2, price: 3, change: 31, changePct: 32, high: 33, low: 34, open: 5 });
      return p ? {
        name: p.name, code: p.code,
        price: parseFloat(p.price) || 0,
        changePct: parseFloat(p.changePct) || 0,
        change: parseFloat(p.change) || 0,
        high: parseFloat(p.high) || 0,
        low: parseFloat(p.low) || 0,
        open: parseFloat(p.open) || 0,
      } : null;
    }).filter(Boolean);

    // Parse gold ETFs (中国国内黄金ETF)
    const goldEtfs = goldEtfRaw.split('\n').filter(Boolean).map(line => {
      const p = parseTencentLine(line, { name: 1, code: 2, price: 3, change: 31, changePct: 32 });
      return p ? {
        name: p.name, code: p.code,
        price: parseFloat(p.price) || 0,
        change: parseFloat(p.change) || 0,
        changePct: parseFloat(p.changePct) || 0,
      } : null;
    }).filter(Boolean);

    // Parse international spot gold/silver from hf_XAU, hf_XAG
    const spotLines = spotRaw.split('\n').filter(Boolean);
    const spotGold = parseHfLine(spotLines.find(l => l.includes('hf_XAU')) || '');
    const spotSilver = parseHfLine(spotLines.find(l => l.includes('hf_XAG')) || '');
    spotPm = { gold: spotGold, silver: spotSilver };

    // Parse news
    let news = [], fedEvents = [];
    if (newsData && newsData.items) {
      for (const item of newsData.items) {
        if (item.source === 'FED') fedEvents.push(item);
        else news.push(item);
      }
    }

    const data = { indices, stocks, etfs, goldEtfs, news, fedEvents, spotGold, spotSilver };
    lastData = data;
    render(data);

    document.getElementById('updateTime').textContent =
      '🕐 更新于 ' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
  } catch (e) {
    console.error(e);
    document.getElementById('loading').innerHTML =
      '<div style="color:var(--up);">⚠️ 数据获取失败: ' + e.message + '</div>';
  }
}

function refreshNow() {
  const btn = document.getElementById('refreshBtn');
  btn.disabled = true; btn.textContent = '⏳ 更新中..';
  fetchAll().finally(() => { btn.disabled = false; btn.textContent = '🔄 刷新数据'; });
}

// ═══════════════════════════════════════════════
// Render
// ═══════════════════════════════════════════════
function render(data) {
  renderIndices(data.indices);
  renderSentiment(data);
  renderRateCutExpectation(data);
  renderETFs(data.etfs);
  renderStocks(data.stocks);
  renderGoldSilver(data);
  renderNews(data.news);
  renderNewsAnalysis(data);
  renderForeignPreview(data);
  renderTomorrowFocus(data);
  renderRecommendations(data);
  renderFedTracking(data);
}

// ─── Market Sentiment ───
function renderSentiment(data) {
  const el = document.getElementById('sentimentPanel');
  if (!el) return;
  const { indices, etfs } = data;

  let score = 0, count = 0;
  for (const idx of indices) {
    if (idx.changePct !== undefined) { score += idx.changePct; count++; }
  }
  const avgPct = count > 0 ? score / count : 0;

  const shIdx = indices.find(i => i.code === '000001');
  const volumeInfo = shIdx && shIdx.volume > 0
    ? '📊 ' + (shIdx.turnover > 1e11 ? (shIdx.turnover / 1e11).toFixed(2) + '千亿' : (shIdx.turnover / 1e8).toFixed(0) + '亿') + ' 成交'
    : '';

  let sentLabel, sentColor;
  if (avgPct > 1.0)   { sentLabel = '🔥 强烈看多'; sentColor = '#ef4444'; }
  else if (avgPct > 0.3) { sentLabel = '📈 偏多'; sentColor = '#f97316'; }
  else if (avgPct > -0.3){ sentLabel = '⚖️ 中性'; sentColor = '#ffc107'; }
  else if (avgPct > -1.0){ sentLabel = '📉 偏空'; sentColor = '#22c55e'; }
  else                     { sentLabel = '🧊 强烈看空'; sentColor = '#22c55e'; }

  const sectorMap = [
    { name: '半导体',     etf: etfs.find(e => e.code === '159995'), color: '#f472b6' },
    { name: '医药',       etf: etfs.find(e => e.code === '512010'), color: '#42a5f5' },
    { name: '新能源',     etf: etfs.find(e => e.code === '515700'), color: '#4fd1c5' },
    { name: '军工',       etf: etfs.find(e => e.code === '512660'), color: '#ff9800' },
    { name: '证券',       etf: etfs.find(e => e.code === '512880'), color: '#ef4444' },
    { name: '科创50',     etf: etfs.find(e => e.code === '588000'), color: '#ab47bc' },
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

  // Spot gold/silver snapshot in sentiment
  let spotHtml = '';
  if (spotPm.gold) {
    const gc = spotPm.gold.changePct >= 0 ? 'up' : 'down';
    spotHtml += '<span class="card" style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;margin:2px;font-size:0.78em;">';
    spotHtml += '<span style="color:var(--gold-light);">🏆 黄金</span>';
    spotHtml += '<span class="' + gc + '">$' + spotPm.gold.price.toFixed(2) + ' (' + (spotPm.gold.changePct >= 0 ? '+' : '') + spotPm.gold.changePct.toFixed(2) + '%)</span></span>';
  }
  if (spotPm.silver) {
    const sc = spotPm.silver.changePct >= 0 ? 'up' : 'down';
    spotHtml += '<span class="card" style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;margin:2px;font-size:0.78em;">';
    spotHtml += '<span style="color:var(--teal);">🥈 白银</span>';
    spotHtml += '<span class="' + sc + '">$' + spotPm.silver.price.toFixed(2) + ' (' + (spotPm.silver.changePct >= 0 ? '+' : '') + spotPm.silver.changePct.toFixed(2) + '%)</span></span>';
  }

  let html = '<div class="grid-4" style="margin-bottom:0;">';
  html += '<div class="card" style="grid-column:span 2;">';
  html += '  <div class="label">市场情绪</div>';
  html += '  <div style="font-size:1.5em;font-weight:700;color:' + sentColor + ';">' + sentLabel + '</div>';
  html += '  <div class="sub" style="color:var(--text-dim);">综合指数: ' + (avgPct >= 0 ? '+' : '') + avgPct.toFixed(2) + '%</div>';
  if (volumeInfo) html += '  <div class="sub" style="color:var(--text-muted);font-size:0.78em;">' + volumeInfo + '</div>';
  html += '</div>';
  html += '<div class="card" style="grid-column:span 2;">';
  html += '  <div class="label">板块热度</div>';
  html += '  <div style="margin-top:4px;line-height:1.8;">' + sectorHtml + '</div>';
  if (spotHtml) html += '  <div class="label" style="margin-top:8px;">国际贵金属</div><div style="line-height:1.8;">' + spotHtml + '</div>';
  html += '</div></div>';
  el.innerHTML = html;
}

// ─── Indices ───
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

// ─── Rate Cut Expectation ───
function renderRateCutExpectation(data) {
  const grid = document.getElementById('rateCutGrid');
  if (!grid) return;
  const rate = data.currentRate || '4.25%-4.50%';
  const schedule = data.fomcSchedule || [];
  let html = '<div class="fed-header-card">';
  html += '<div class="fed-rate"><span class="fed-rate-label">当前联邦基金利率</span>';
  html += '<span class="fed-rate-value">' + rate + '</span>';
  html += '<span class="fed-rate-sub">2026年 · 已历3次会议</span></div>';
  const upcoming = schedule.find(function(s){return s.status==='待召开';}) || null;
  html += '<div class="fed-next"><span class="fed-next-label">下次 FOMC</span>';
  if (upcoming) {
    const d = new Date(upcoming.date);
    const diff = Math.ceil((d - new Date()) / (1000*60*60*24));
    html += '<div class="fed-next-date">' + upcoming.label + '</div>';
    html += '<div class="fed-next-days">距离会议还有 ' + diff + ' 天</div>';
  } else {
    html += '<div class="fed-next-date" style="color:#7C8AAA;">暂无</div>';
  }
  html += '</div></div><div class="fomc-grid">';
  for (let i=0;i<schedule.length;i++) {
    const m=schedule[i], up=m.status==='待召开';
    const cls=up?'fomc-card fomc-upcoming':'fomc-card fomc-past';
    html+='<div class="'+cls+'"><div class="fomc-date">'+m.date+'</div>';
    html+='<div class="fomc-label">'+m.label+'</div>';
    html+='<div class="fomc-type">'+m.type+'</div>';
    html+='<span class="fomc-status status-'+(up?'waiting':'done')+'">'+m.status+'</span>';
    if (up) {
      const pmap={'9月FOMC':'45%','9月联储会议':'45%','11月FOMC':'55%','12月FOMC':'68%'};
      const p=pmap[m.label]||'--', pv=parseInt(p)||0;
      const pc=pv>50?'#2EC4B6':pv>30?'#E8D48B':'#7C8AAA';
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

// ─── ETFs ───
function renderETFs(etfs) {
  const grid = document.getElementById('etfGrid');
  if (!grid) return;
  let html='';
  for(let i=0;i<etfs.length;i++){const e=etfs[i],cls=e.changePct>=0?'up':'down',arrow=e.changePct>=0?'▲':'▼';
    const vs=e.volume>0?(e.volume/10000).toFixed(0)+'万':'--';
    html+='<div class="semi-etf-card"><div class="sec-top"><span class="sec-name">'+e.name+'</span><span class="sec-code">'+e.code+'</span></div>';
    html+='<div class="sec-price-row"><span class="sec-price '+cls+'">'+e.price.toFixed(3)+'</span>';
    html+='<span class="sec-change '+cls+'">'+arrow+' '+(e.changePct>=0?'+':'')+e.changePct.toFixed(2)+'%</span></div>';
    html+='<div class="sec-vol">成交量 '+vs+'</div></div>';}
  grid.innerHTML=html;
}

// ─── Semiconductor Stocks ───
function renderStocks(stocks) {
  const el=document.getElementById('stockList');if(!el)return;
  let html='<div class="semi-stock-table"><div class="semi-stock-row ss-header"><span>名称</span><span>现价</span><span>涨跌幅</span><span>标签</span></div>';
  const tags={'688981':'芯片巨头','688012':'刻蚀设备','688008':'存储接口','688126':'封装测试','603986':'存储芯片','600703':'显示芯片','600171':'制造代工','688019':'材料龙头','688200':'测试设备','688018':'设备精兵','688072':'检测设备','688041':'设计精英','688256':'算力芯片','600460':'模拟芯片'};
  const tcs={'芯片巨头':'tag-leader','刻蚀设备':'tag-equip','存储接口':'tag-interface','封装测试':'tag-test','存储芯片':'tag-interface','显示芯片':'tag-leader','制造代工':'tag-equip','材料龙头':'tag-test','测试设备':'tag-test','设备精兵':'tag-equip','检测设备':'tag-test','设计精英':'tag-leader','算力芯片':'tag-leader','模拟芯片':'tag-interface'};
  for(let i=0;i<stocks.length;i++){const s=stocks[i],cls=s.changePct>=0?'up':'down',arrow=s.changePct>=0?'▲':'▼';
    const tag=tags[s.code]||'半导体',tc=tcs[tag]||'tag-leader';
    html+='<div class="semi-stock-row"><div class="ss-name">'+s.name+' <span class="ss-sub">'+s.code+'</span></div>';
    html+='<span class="ss-price '+cls+'">'+s.price.toFixed(2)+'</span>';
    html+='<span class="ss-change '+cls+'">'+arrow+' '+(s.changePct>=0?'+':'')+s.changePct.toFixed(2)+'%</span>';
    html+='<span class="ss-tag '+tc+'">'+tag+'</span></div>';}
  html+='</div>';el.innerHTML=html;
}

// ─── Gold & Silver (国际现货 + 国内ETF) ───
function renderGoldSilver(data) {
  const grid = document.getElementById('goldGrid');
  if (!grid) return;

  // International spot prices (实时国际现货)
  const sg = data.spotGold;
  const ss = data.spotSilver;

  // Chinese gold ETFs (国内黄金ETF，非交易时段显示昨收)
  const ge = data.goldEtfs || [];
  const etf518880 = ge.find(e => e.code === '518880');
  const etf518800 = ge.find(e => e.code === '518800');

  let html = '';

  // Card 1: 国际现货黄金
  if (sg) {
    const cls = sg.changePct >= 0 ? 'up' : 'down';
    const arrow = sg.changePct >= 0 ? '▲' : '▼';
    html += '<div class="pm-card pm-gold">';
    html += '<div class="pm-icon">🏆</div>';
    html += '<div class="pm-metal"><strong>国际现货黄金</strong> <span style="color:#5E6A8A;">XAU/USD · 实时</span></div>';
    html += '<div class="pm-price-row"><span class="pm-price">$' + sg.price.toFixed(2) + '</span>';
    html += '<span class="pm-change ' + cls + '">' + arrow + ' ' + (sg.changePct >= 0 ? '+' : '') + sg.changePct.toFixed(2) + '%</span></div>';
    html += '<div class="pm-details"><span>💰 昨收 $' + sg.prevClose.toFixed(2) + '</span><span>📈 高 $' + sg.high.toFixed(2) + '</span><span>📉 低 $' + sg.low.toFixed(2) + '</span></div>';
    html += '</div>';
  }

  // Card 2: 国际现货白银
  if (ss) {
    const cls = ss.changePct >= 0 ? 'up' : 'down';
    const arrow = ss.changePct >= 0 ? '▲' : '▼';
    html += '<div class="pm-card pm-silver">';
    html += '<div class="pm-icon">🥈</div>';
    html += '<div class="pm-metal"><strong>国际现货白银</strong> <span style="color:#5E6A8A;">XAG/USD · 实时</span></div>';
    html += '<div class="pm-price-row"><span class="pm-price">$' + ss.price.toFixed(2) + '</span>';
    html += '<span class="pm-change ' + cls + '">' + arrow + ' ' + (ss.changePct >= 0 ? '+' : '') + ss.changePct.toFixed(2) + '%</span></div>';
    html += '<div class="pm-details"><span>💰 昨收 $' + ss.prevClose.toFixed(2) + '</span><span>📈 高 $' + ss.high.toFixed(2) + '</span><span>📉 低 $' + ss.low.toFixed(2) + '</span></div>';
    html += '</div>';
  }

  // Card 3: 国内黄金ETF
  if (etf518880) {
    const cls = etf518880.changePct >= 0 ? 'up' : 'down';
    const arrow = etf518880.changePct >= 0 ? '▲' : '▼';
    html += '<div class="pm-card" style="border-color:rgba(201,168,76,0.15);border-left:3px solid var(--gold);">';
    html += '<div class="pm-icon">🏛️</div>';
    html += '<div class="pm-metal"><strong>' + etf518880.name + '</strong> <span style="color:#5E6A8A;">' + etf518880.code + ' · 国内</span></div>';
    html += '<div class="pm-price-row"><span class="pm-price" style="color:var(--gold-light);">¥' + etf518880.price.toFixed(3) + '</span>';
    html += '<span class="pm-change ' + cls + '">' + arrow + ' ' + (etf518880.changePct >= 0 ? '+' : '') + etf518880.changePct.toFixed(2) + '%</span></div>';
    // Estimate CNY/g from ETF: each share = 0.01g
    const cnyPerGram = (etf518880.price / 0.01);
    html += '<div class="pm-details"><span>≈ ¥' + cnyPerGram.toFixed(1) + '/g</span><span>🏪 沪市ETF</span></div>';
    html += '</div>';
  }

  // Card 4: 国内黄金ETF (518800 - was mislabeled as silver before)
  if (etf518800) {
    const cls = etf518800.changePct >= 0 ? 'up' : 'down';
    const arrow = etf518800.changePct >= 0 ? '▲' : '▼';
    html += '<div class="pm-card" style="border-color:rgba(201,168,76,0.15);border-left:3px solid var(--gold-dark);">';
    html += '<div class="pm-icon">🏛️</div>';
    html += '<div class="pm-metal"><strong>' + etf518800.name + '</strong> <span style="color:#5E6A8A;">' + etf518800.code + ' · 国内</span></div>';
    html += '<div class="pm-price-row"><span class="pm-price" style="color:var(--gold-light);">¥' + etf518800.price.toFixed(3) + '</span>';
    html += '<span class="pm-change ' + cls + '">' + arrow + ' ' + (etf518800.changePct >= 0 ? '+' : '') + etf518800.changePct.toFixed(2) + '%</span></div>';
    const cnyPerGram2 = (etf518800.price / 0.01);
    html += '<div class="pm-details"><span>≈ ¥' + cnyPerGram2.toFixed(1) + '/g</span><span>🏪 沪市ETF</span></div>';
    html += '</div>';
  }

  // If no data at all
  if (!sg && !ss && !etf518880) {
    html += '<div class="card" style="grid-column:1/-1;text-align:center;padding:30px;">';
    html += '<span style="color:var(--text-muted);">暂无贵金属数据</span></div>';
  }

  grid.innerHTML = html;
}

// ─── News ───
function renderNews(news) {
  const list = document.getElementById('newsList');
  if (!list) return;
  let html = '';
  if (!news || news.length === 0) {
    html = '<div class="news-item"><span style="color:var(--text-muted);">暂无新闻数据，GitHub Actions 未运行或缓存尚未生成</span></div>';
  } else {
    for (const item of news.slice(0, 10)) {
      const tagColor = item.source === 'US' ? 'tag-market' : 'tag-hot';
      html += '<div class="news-item"><div class="news-title"><a href="' + escHtml(item.link) + '" target="_blank">' + escHtml(item.title) + '</a></div>';
      html += '<div class="news-meta"><span class="card-tag ' + tagColor + '">' + (item.source || '全球') + '</span>';
      html += '<span>' + formatDate(item.pubDate) + '</span>';
      if (item.category) html += '<span style="color:var(--text-dim);">' + item.category + '</span>';
      html += '</div>';
      if (item.content) html += '<div class="news-desc">' + escHtml(item.content.substring(0, 200)) + '</div>';
      html += '</div>';
    }
  }
  list.innerHTML = html;
}

// ─── News Analysis ───
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
  if (ratio > 60) summary = '📰 消息面偏积极，利好新闻占比 ' + ratio + '%';
  else if (ratio > 40) summary = '📰 消息面中性，多空交织';
  else summary = '📰 消息面偏谨慎，利空新闻占比 ' + (100 - parseInt(ratio)) + '%';
  const sh = indices.find(i => i.code === '000001');
  if (sh && Math.abs(sh.changePct) > 1) {
    summary += ' · 大盘' + (sh.changePct > 0 ? '强势' : '弱势') + ' (涨跌幅 ' + (sh.changePct >= 0 ? '+' : '') + sh.changePct.toFixed(2) + '%)';
  }
  el.innerHTML = '<div style="font-size:0.85em;color:var(--text-muted);padding:8px 0;">' + summary + '</div>';
}

// ─── Foreign Preview ───
function renderForeignPreview(data) {
  const el = document.getElementById('foreignPreview');
  if (!el) return;
  const usNews = (data.news || []).filter(n => n.source === 'US').slice(0, 3);
  let html = '';
  if (usNews.length > 0) {
    html += '<div style="font-size:0.85em;"><div style="color:var(--text-muted);margin-bottom:6px;">🇺🇸 隔夜市场关注</div>';
    for (const item of usNews) {
      html += '<div class="news-item" style="padding:8px 10px;"><div class="news-title" style="font-size:0.82em;"><a href="' + escHtml(item.link) + '" target="_blank">' + escHtml(item.title) + '</a></div>';
      html += '<div class="news-meta" style="font-size:0.72em;">' + formatDate(item.pubDate) + '</div></div>';
    }
    html += '</div>';
  } else {
    html = '<div style="font-size:0.82em;color:var(--text-dim);">暂无隔夜市场数据</div>';
  }
  el.innerHTML = html;
}

// ─── Tomorrow Focus ───
function renderTomorrowFocus(data) {
  const el = document.getElementById('tomorrowFocus');
  if (!el) return;
  const { indices } = data;
  const sh = indices.find(i => i.code === '000001');
  const isUp = sh && sh.changePct > 0;
  let html = '<ul style="list-style:none;font-size:0.85em;padding:0;color:var(--text-muted);">';
  if (isUp) {
    html += '  <li style="padding:4px 0;">• 今日市场反弹，关注明日量能能否继续放大</li>';
    html += '  <li style="padding:4px 0;">• 北向资金是否连续净买入为关键信号</li>';
  } else {
    html += '  <li style="padding:4px 0;">• 今日市场回调，关注支撑位能否有效抵御</li>';
    html += '  <li style="padding:4px 0;">• 隔夜美股期货走势对明日情绪影响重大</li>';
  }
  html += '  <li style="padding:4px 0;">• 集合竞价观察情绪延续性</li>';
  html += '  <li style="padding:4px 0;">• 重点关注半导体/黄金等核心赛道表现</li>';
  html += '</ul>';
  el.innerHTML = html;
}

// ─── Trading Recommendations (无个股价格绑定) ───
function renderRecommendations(data) {
  const list = document.getElementById('recommendList');
  if (!list) return;

  // Sector-level strategy recommendations — no individual stock prices
  const strategies = [
    {
      sector: '半导体',
      icon: '💾',
      color: '#5B8DEF',
      bg: 'rgba(91,141,239,0.15)',
      signal: '积极关注',
      signalClass: 'buy',
      signalIcon: '⬆️',
      risk: '中等',
      riskPct: 50,
      riskColor: '#F5A623',
      logic: 'AI算力需求持续爆发，存储芯片涨价周期延续。国产替代逻辑不变，逢回调可分批布局半导体ETF及设备龙头。',
      border: 'sector-semi',
    },
    {
      sector: '黄金',
      icon: '🏆',
      color: '#E8D48B',
      bg: 'rgba(201,168,76,0.15)',
      signal: '持有/配置',
      signalClass: 'hold',
      signalIcon: '📍',
      risk: '中等',
      riskPct: 50,
      riskColor: '#F5A623',
      logic: '全球央行购金持续+美元信用弱化趋势。短期回调是配置窗口，中期多头趋势未变。建议逢回调分批建仓黄金ETF。',
      border: 'sector-gold',
    },
    {
      sector: '白银',
      icon: '🥈',
      color: '#2EC4B6',
      bg: 'rgba(46,196,182,0.15)',
      signal: '谨慎关注',
      signalClass: 'watch',
      signalIcon: '👀',
      risk: '较高',
      riskPct: 70,
      riskColor: '#F05A5A',
      logic: '白银工业属性+贵金属双重驱动。光伏用银需求增长+金银比高位，但波动大于黄金，适合风险偏好较高的投资者。',
      border: 'sector-silver',
    },
    {
      sector: '存储芯片',
      icon: '🔲',
      color: '#F05A8A',
      bg: 'rgba(240,90,138,0.15)',
      signal: '买入',
      signalClass: 'buy',
      signalIcon: '⬆️',
      risk: '中等',
      riskPct: 45,
      riskColor: '#E8D48B',
      logic: 'DDR5渗透率提升+AI服务器DRAM需求直接受益。存储接口芯片、NOR Flash龙头业绩硬逻辑，回调是布局机会。',
      border: 'sector-storage',
    },
  ];

  let html = '<div class="trade-signal-grid">';
  for (const st of strategies) {
    html += '<div class="trade-card ' + st.border + '">';
    html += '<div class="tc-top">';
    html += '<span class="tc-sector" style="background:' + st.bg + ';color:' + st.color + '">' + st.icon + ' ' + st.sector + '</span>';
    html += '<span class="tc-signal ' + st.signalClass + '">' + st.signalIcon + ' ' + st.signal + '</span>';
    html += '</div>';
    html += '<div class="tc-name" style="margin-bottom:8px;">' + st.sector + '板块策略</div>';
    html += '<div class="tc-logic">' + st.logic + '</div>';
    html += '<div class="tc-risk" style="margin-top:8px;">';
    html += '<span class="tc-risk-label">⚡ 风险</span>';
    html += '<div class="tc-risk-bar"><div class="tc-risk-bar-fill" style="width:' + st.riskPct + '%;background:' + st.riskColor + '"></div></div>';
    html += '<span class="tc-risk-text" style="color:' + st.riskColor + '">' + st.risk + '</span>';
    html += '</div></div>';
  }
  html += '</div>';
  list.innerHTML = html;
}

// ─── Fed Tracking ───
function renderFedTracking(data) {
  const el = document.getElementById('fedTracking'); if (!el) return;
  const fed = data.fedEvents || [];
  let html = '<div class="fed-events">';
  if (fed.length > 0) {
    for (let i = 0; i < Math.min(fed.length, 5); i++) {
      const it = fed[i];
      html += '<div class="fed-event-item"><div class="fe-title"><a href="' + escHtml(it.link) + '" target="_blank">' + escHtml(it.title) + '</a></div>';
      html += '<div class="fe-meta">' + formatDate(it.pubDate) + ' · ' + (it.source || '美联储动态') + '</div></div>';
    }
  } else {
    html += '<div style="font-size:0.82em;color:#7C8AAA;padding:12px;">暂无最新美联储动态</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

// ─── Helpers ───
function formatDate(str) {
  if (!str) return '';
  try {
    return new Date(str).toLocaleDateString('zh-CN', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return str; }
}
function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ─── Auto-refresh ───
function startAutoRefresh() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = setInterval(fetchAll, 5 * 60 * 1000);
}

// ─── Init ───
fetchAll();
startAutoRefresh();
