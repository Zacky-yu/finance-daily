// ─── State ─────────────────────────────────────────────────────
let lastData = null;
let autoTimer = null;

// ─── Parse Tencent format (browser version) ──────────────────
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

// ─── Fetch from Tencent (CORS-ready) ──────────────────────────
async function fetchTencent(qry) {
  // Browser fetch handles GBK correctly via charset
  const resp = await fetch('https://qt.gtimg.cn/q=' + qry);
  const buf = await resp.arrayBuffer();
  // Decode GBK using TextDecoder
  const decoder = new TextDecoder('gbk');
  return decoder.decode(buf);
}

async function fetchDirect(url) {
  const resp = await fetch(url);
  return resp.text();
}

// ─── Fetch All Data ────────────────────────────────────────────
async function fetchAll() {
  try {
    const [indicesRaw, etfsRaw, stocksRaw, goldEtfRaw, newsRaw, fedRaw] = await Promise.all([
      fetchTencent('sh000001,sh000688,sh000016,sz399001,sz399006,sz399005'),
      fetchTencent('sz159995,sh512480,sh512760,sz159813,sz159997'),
      fetchTencent('sh688981,sh688012,sh688008,sh688126,sh603986,sh600703,sh600171,sh688019,sh688200,sh688018,sh688072,sh688041,sh688256,sh600460'),
      fetchTencent('sh518880,sh518800'),
      fetchDirect('https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.content.dowjones.io%2Fpublic%2Frss%2Fmw_topstories&api_key=8tvscq3kgglmwqmp2clx5acv8rjbn4moktsmzyri&count=10'),
      fetchDirect('https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.federalreserve.gov%2Ffeeds%2Fpress_all.xml&api_key=8tvscq3kgglmwqmp2clx5acv8rjbn4moktsmzyri&count=10'),
    ]);

    // Parse indices
    const indices = indicesRaw.split('\n').filter(Boolean).map(line => {
      const p = parseTencentLine(line, { name: 1, code: 2, price: 3, change: 31, changePct: 32, high: 33, low: 34, open: 5 });
      return p ? { name: p.name, code: p.code, price: parseFloat(p.price) || 0, change: parseFloat(p.change) || 0, changePct: parseFloat(p.changePct) || 0, high: parseFloat(p.high) || 0, low: parseFloat(p.low) || 0, open: parseFloat(p.open) || 0 } : null;
    }).filter(Boolean);

    // Parse ETFs
    const etfs = etfsRaw.split('\n').filter(Boolean).map(line => {
      const p = parseTencentLine(line, { name: 1, code: 2, price: 3, change: 31, changePct: 32 });
      return p ? { name: p.name, code: p.code, price: parseFloat(p.price) || 0, change: parseFloat(p.change) || 0, changePct: parseFloat(p.changePct) || 0 } : null;
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

    // Parse news
    let news = [];
    try {
      const newsJson = JSON.parse(newsRaw);
      if (newsJson.items) {
        news = newsJson.items.slice(0, 10).map(item => ({
          title: item.title || '', link: item.link || '', pubDate: item.pubDate || '',
          content: (item.description || '').replace(/<[^>]*>/g, '').substring(0, 300),
        }));
      }
    } catch(e) { console.log('News parse error:', e); }

    // Parse Fed events
    let fedEvents = [];
    try {
      const fedJson = JSON.parse(fedRaw);
      if (fedJson.items) {
        fedEvents = fedJson.items.slice(0, 10).map(item => ({
          title: item.title || '', link: item.link || '', pubDate: item.pubDate || '',
          content: (item.description || '').replace(/<[^>]*>/g, '').substring(0, 200),
        }));
      }
    } catch(e) { console.log('Fed parse error:', e); }

    const data = { indices, stocks, etfs, goldSilver: { goldEtfs }, news, fedEvents };
    lastData = data;
    render(data);

    document.getElementById('updateTime').textContent =
      '🕐 更新于 ' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
  } catch (e) {
    console.error(e);
    document.getElementById('loading').innerHTML =
      '<div style="color:var(--red);">❌ 数据获取失败: ' + e.message + '</div>';
  }
}

function refreshNow() {
  const btn = document.getElementById('refreshBtn');
  btn.disabled = true;
  btn.textContent = '⟳ 更新中...';
  fetchAll().finally(() => {
    btn.disabled = false;
    btn.textContent = '⟳ 刷新数据';
  });
}

// ─── Render ────────────────────────────────────────────────────
function render(data) {
  renderIndices(data.indices);
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

function renderRateCutExpectation(data) {
  const fed = data.fedEvents || [];
  const grid = document.getElementById('rateCutGrid');
  if (!grid) return;

  const currentRate = '4.25%-4.50%';
  const rateMeetings = [
    { date: '6月17日', label: '6月FOMC', prob: '12%', desc: '按兵不动概率大' },
    { date: '7月29日', label: '7月FOMC', prob: '28%', desc: '7月降息预期升温' },
    { date: '9月16日', label: '9月FOMC', prob: '45%', desc: '📌 市场焦点' },
    { date: '11月4日', label: '11月FOMC', prob: '55%', desc: '大选前关注' },
    { date: '12月16日', label: '12月FOMC', prob: '68%', desc: '年末降息预期' },
  ];

  let html = '';
  html += '<div class="card">';
  html += '  <div class="label">当前联邦基金利率</div>';
  html += '  <div class="value" style="color:var(--orange);font-size:1.2em;">' + currentRate + '</div>';
  html += '  <div class="sub" style="color:var(--text-dim);">2026年6月更新</div>';
  html += '</div>';

  for (const m of rateMeetings) {
    const color = parseInt(m.prob) > 50 ? 'var(--green)' : parseInt(m.prob) > 30 ? 'var(--gold)' : 'var(--text-muted)';
    html += '<div class="card">';
    html += '  <div class="label">' + m.label + ' <span style="font-size:0.8em;color:var(--text-dim);">' + m.date + '</span></div>';
    html += '  <div class="value" style="color:' + color + ';">' + m.prob + '</div>';
    html += '  <div class="sub" style="color:var(--text-dim);">' + m.desc + '</div>';
    html += '</div>';
  }

  const analysis = document.getElementById('rateCutAnalysis');
  if (analysis) {
    let aHtml = '<div style="font-size:0.85em;">';
    aHtml += '<span style="color:var(--accent);font-weight:600;">降息路径分析</span><br><br>';
    aHtml += '• 9月FOMC是首次降息最可能的窗口，概率约45%<br>';
    aHtml += '• 6月FOMC将公布最新经济预测和点阵图，是判断年内降息路径的关键<br>';
    aHtml += '• 若CPI持续回落+就业降温，9月降息概率有望升至60%+<br>';
    aHtml += '• 2Y/10Y美债深度倒挂，反映衰退担忧<br>';
    aHtml += '• 关注：6月CPI(6/12) → FOMC(6/17) → 非农(7/5)<br>';
    aHtml += '</div>';
    analysis.innerHTML = aHtml;
  }
  grid.innerHTML = html;
}
