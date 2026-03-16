const URL_BOI = 'https://www.scotconsultoria.com.br/cotacoes/boi-gordo/?ref=foo';
const URL_GRAOS = 'https://www.scotconsultoria.com.br/cotacoes/graos/?ref=foo';
const URL_FUTURO = 'https://www.scotconsultoria.com.br/cotacoes/mercado-futuro/?ref=foo';
const URL_NEWS =
  'https://news.google.com/rss/search?q=pecu%C3%A1ria+de+corte+OR+boi+gordo+OR+mercado+do+boi+OR+milho+OR+soja+Brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function decodeEntities(text = '') {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&atilde;/gi, 'ã')
    .replace(/&otilde;/gi, 'õ')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&agrave;/gi, 'à')
    .replace(/&ecirc;/gi, 'ê')
    .replace(/&ocirc;/gi, 'ô')
    .replace(/&uuml;/gi, 'ü');
}

function normalizeText(text = '') {
  return decodeEntities(text)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(text = '') {
  return decodeEntities(
    text
      .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function brToNumber(value) {
  if (!value) return null;
  const n = Number(String(value).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function moneyArroba(value) {
  if (value == null) return null;
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}/@`;
}

function moneySaca(value) {
  if (value == null) return null;
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}/sc`;
}

function percentText(value) {
  if (value == null) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const signal = n > 0 ? '+' : '';
  return `${signal}${n.toFixed(2).replace('.', ',')}%`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      referer: 'https://www.google.com/',
      pragma: 'no-cache',
      'cache-control': 'no-cache',
    },
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error
