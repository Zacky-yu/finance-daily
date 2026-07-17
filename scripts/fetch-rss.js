const fs = require('fs');
const https = require('https');

const RSS_URL = 'https://feeds.content.dowjones.io/public/rss/mw_topstories';
const OUTPUT = 'public/news-cache.json';

https.get(RSS_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
  let xml = '';
  res.on('data', c => xml += c);
  res.on('end', () => {
    const items = [];
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = re.exec(xml)) !== null && items.length < 10) {
      const ix = m[1];
      const g = (tag) => {
        const p = new RegExp('<' + tag + '[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/' + tag + '>|<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>');
        const r = p.exec(ix);
        return (r && (r[1] || r[2] || '')).trim();
      };
      items.push({
        title: g('title'),
        link: g('link'),
        pubDate: g('pubDate'),
        content: g('description').replace(/<[^>]*>/g, '').substring(0, 300),
      });
    }
    const result = { items, fetchedAt: new Date().toISOString(), count: items.length };
    fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
    console.log('Saved ' + items.length + ' items to ' + OUTPUT);
  });
}).on('error', e => { console.error('Fetch failed:', e.message); process.exit(1); });
