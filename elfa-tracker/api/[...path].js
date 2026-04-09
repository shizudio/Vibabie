export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const pathParts = Array.isArray(req.query.path)
    ? req.query.path
    : [req.query.path].filter(Boolean);

  const targetPath = '/' + pathParts.join('/');

  // Reconstruct query string from original URL, stripping Vercel's injected `path` param
  const urlObj = new URL(req.url, 'https://placeholder.com');
  urlObj.searchParams.delete('path');
  const queryString = urlObj.search;

  const targetUrl = `https://api.elfa.ai${targetPath}${queryString}`;

  const fetchOpts = {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'x-elfa-api-key': process.env.ELFA_API_KEY || '',
    },
  };

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
    fetchOpts.body = JSON.stringify(req.body);
  }

  const upstream = await fetch(targetUrl, fetchOpts);
  const text = await upstream.text();

  res.status(upstream.status)
    .setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    .send(text);
}
