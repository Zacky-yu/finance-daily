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
