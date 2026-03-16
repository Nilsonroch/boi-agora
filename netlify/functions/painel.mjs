const URL_BOI = 'https://www.scotconsultoria.com.br/cotacoes/boi-gordo/?ref=foo';
const URL_GRAOS = 'https://www.scotconsultoria.com.br/cotacoes/graos/?ref=foo';
const URL_FUTURO = 'https://www.scotconsultoria.com.br/cotacoes/mercado-futuro/?ref=foo';
const URL_NEWS =
  'https://news.google.com/rss/search?q=pecu%C3%A1ria+de+corte+OR+boi+gordo+OR+mercado+do+boi+OR+milho+OR+soja+Brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419';

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
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

function stripHtml(text = '') {
  return decodeEntities(
    text
      .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
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

  return {
    ok: response.ok,
    status: response.status,
    url,
    body,
    headers: {
      contentType: response.headers.get('content-type'),
      cacheControl: response.headers.get('cache-control'),
      server: response.headers.get('server'),
    },
  };
}

function preview(text = '', size = 4000) {
  return decodeEntities(text).slice(0, size);
}

function lines(text = '', count = 80) {
  return decodeEntities(text)
    .replace(/<\/(tr|p|div|li|h1|h2|h3|h4|br|table|thead|tbody|td|th|section|article)>/gi, '\n')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, count);
}

function extractNewsItems(xml, maxItems = 6) {
  const items = [];
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

  for (const block of blocks.slice(0, maxItems)) {
    const raw = block[1] || '';
    const title = stripHtml((raw.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
    const link = stripHtml((raw.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || '');
    const source = stripHtml((raw.match(/<source[^>]*>([\s\S]*?)<\/source>/i) || [])[1] || '') || 'Google News';

    if (title && link) {
      items.push({ title, link, source });
    }
  }

  return items;
}

export default async () => {
  try {
    const [boi, graos, futuro, news] = await Promise.all([
      fetchText(URL_BOI),
      fetchText(URL_GRAOS),
      fetchText(URL_FUTURO),
      fetchText(URL_NEWS),
    ]);

    return json({
      timestamp: new Date().toISOString(),
      sources: {
        boi: {
          ok: boi.ok,
          status: boi.status,
          url: boi.url,
          headers: boi.headers,
          preview: preview(boi.body),
          lines: lines(boi.body),
          hasGoias: /Goi[aá]s/i.test(decodeEntities(boi.body)),
          hasSaoPaulo: /S[aã]o Paulo/i.test(decodeEntities(boi.body)),
          hasBarretos: /Barretos/i.test(decodeEntities(boi.body)),
          hasGoiiania: /Goi[aâ]nia/i.test(decodeEntities(boi.body)),
        },
        graos: {
          ok: graos.ok,
          status: graos.status,
          url: graos.url,
          headers: graos.headers,
          preview: preview(graos.body),
          lines: lines(graos.body),
          hasItumbiara: /Itumbiara/i.test(decodeEntities(graos.body)),
          hasJatai: /Jata[ií]/i.test(decodeEntities(graos.body)),
          hasMineiros: /Mineiros/i.test(decodeEntities(graos.body)),
          hasSantos: /Santos/i.test(decodeEntities(graos.body)),
          hasSaoPaulo: /S[aã]o Paulo/i.test(decodeEntities(graos.body)),
        },
        futuro: {
          ok: futuro.ok,
          status: futuro.status,
          url: futuro.url,
          headers: futuro.headers,
          preview: preview(futuro.body),
          lines: lines(futuro.body),
          hasMar26: /Mar\/\d{2}/i.test(decodeEntities(futuro.body)),
          hasAbr26: /Abr\/\d{2}/i.test(decodeEntities(futuro.body)),
          hasMai26: /Mai\/\d{2}/i.test(decodeEntities(futuro.body)),
        },
        noticias: {
          ok: news.ok,
          status: news.status,
          url: news.url,
          headers: news.headers,
          items: extractNewsItems(news.body),
        },
      },
    });
  } catch (error) {
    return json({
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
};
