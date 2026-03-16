const URL_BOI = 'https://www.scotconsultoria.com.br/cotacoes/boi-gordo/?ref=foo';
const URL_GRAOS = 'https://www.scotconsultoria.com.br/cotacoes/graos/?ref=foo';
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

function stripHtmlWithLines(html = '') {
  return decodeEntities(
    html
      .replace(/<\/(tr|p|div|li|h1|h2|h3|h4|br|table|thead|tbody|td|th|section|article)>/gi, '\n')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
  );
}

function toLines(text = '') {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function brToNumber(value) {
  if (!value) return 0;
  return Number(String(value).replace(/\./g, '').replace(',', '.'));
}

function moneyArroba(value) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}/@`;
}

function moneySaca(value) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}/sc`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'BoiAgora/1.0',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar ${url}: ${response.status}`);
  }

  return response.text();
}

function extractPublishedAt(lines) {
  const line = lines.find((item) =>
    /\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\s+de\s+[a-zçãéôíóú]+\s+de\s+\d{4}|[A-Za-zçÇãõáéíóúâêô]+,\s*\d{1,2}\s+de/i.test(
      item
    )
  );
  return line || '';
}

function normalizeRegionName(region = '') {
  return region.replace(/\s+/g, ' ').trim();
}

function parseBoiRows(lines) {
  const rows = [];

  for (const line of lines) {
    const match = line.match(
      /^(SP Barretos|SP Araçatuba|MG Triângulo|MG B\.Horizonte|MG Norte|MG Sul|GO Goiânia|GO Reg\. Sul|MS Dourados|MS C\. Grande|MT Cuiabá\*?|MT Sudeste|MT Sudoeste|MT Norte|BA Sul|BA Oeste|TO Sul)\s+(\d{1,3},\d{2})\s+(\d{1,3},\d{2})/i
    );

    if (!match) continue;

    rows.push({
      region: normalizeRegionName(match[1]),
      cash: brToNumber(match[2]),
      term: brToNumber(match[3]),
    });
  }

  return rows;
}

function parseGraos(lines) {
  const milhoRows = [];
  const sojaRows = [];

  let mode = '';
  let currentUf = '';

  for (const line of lines) {
    if (/^MILHO\s*-/i.test(line)) {
      mode = 'milho';
      currentUf = '';
      continue;
    }

    if (/^SOJA\s*-/i.test(line)) {
      mode = 'soja';
      currentUf = '';
      continue;
    }

    if (!mode) continue;
    if (/^Preços médios|^UF Cidade Compra|^\*/i.test(line)) continue;

    let match = line.match(/^([A-Z]{2})\s+(.+?)\s+(\d{1,3},\d{2})$/);
    if (match) {
      currentUf = match[1];
      const row = {
        uf: currentUf,
        city: decodeEntities(match[2]).trim(),
        price: brToNumber(match[3]),
      };
      if (mode === 'milho') milhoRows.push(row);
      if (mode === 'soja') sojaRows.push(row);
      continue;
    }

    match = line.match(/^(.+?)\s+(\d{1,3},\d{2})$/);
    if (match && currentUf) {
      const row = {
        uf: currentUf,
        city: decodeEntities(match[1]).trim(),
        price: brToNumber(match[2]),
      };
      if (mode === 'milho') milhoRows.push(row);
      if (mode === 'soja') sojaRows.push(row);
    }
  }

  return { milhoRows, sojaRows };
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

function extractNewsItems(xml, maxItems = 6) {
  const items = [];
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

  for (const block of blocks.slice(0, maxItems)) {
    const raw = block[1] || '';
    const title = stripHtml((raw.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
    const link = stripHtml((raw.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || '');
    const source = stripHtml((raw.match(/<source[^>]*>([\s\S]*?)<\/source>/i) || [])[1] || '') || 'Google News';

    if (title && link) items.push({ title, link, source });
  }

  return items;
}

function cityProfile(city) {
  const key = String(city || 'jatai').toLowerCase();

  const profiles = {
    jatai: {
      label: 'Jataí (GO)',
      boiRegion: 'GO Reg. Sul',
      milho: [
        { uf: 'GO', city: 'Itumbiara', note: 'Última referência publicada mais próxima disponível em Goiás' },
      ],
      soja: [
        { uf: 'GO', city: 'Rio Verde', note: 'Última referência publicada mais próxima disponível em Goiás' },
        { uf: 'GO', city: 'Jataí', note: 'Cotação publicada para Jataí (GO)' },
      ],
    },
    mineiros: {
      label: 'Mineiros (GO)',
      boiRegion: 'GO Reg. Sul',
      milho: [{ uf: 'GO', city: 'Itumbiara', note: 'Última referência publicada mais próxima disponível em Goiás' }],
      soja: [{ uf: 'GO', city: 'Mineiros', note: 'Cotação publicada para Mineiros (GO)' }],
    },
    formosa: {
      label: 'Formosa (GO)',
      boiRegion: 'GO Goiânia',
      milho: [{ uf: 'GO', city: 'Itumbiara', note: 'Última referência publicada disponível em Goiás' }],
      soja: [{ uf: 'DF', city: 'Brasília', note: 'Última referência publicada mais próxima disponível' }],
    },
    uberlandia: {
      label: 'Uberlândia (MG)',
      boiRegion: 'MG Triângulo',
      milho: [{ uf: 'MG', city: 'Uberlândia', note: 'Cotação publicada para Uberlândia (MG)' }],
      soja: [{ uf: 'MG', city: 'Uberlândia', note: 'Cotação publicada para Uberlândia (MG)' }],
    },
  };

  return profiles[key] || profiles.jatai;
}

function pickRow(rows, preferences = []) {
  for (const pref of preferences) {
    const found = rows.find(
      (row) => row.uf.toUpperCase() === pref.uf.toUpperCase() && row.city.toLowerCase() === pref.city.toLowerCase()
    );
    if (found) return { ...found, note: pref.note || '' };
  }
  return rows[0] ? { ...rows[0], note: 'Última referência publicada disponível' } : null;
}

function buildPayload({ city, boiRows, milhoRows, sojaRows, news, publishedAt }) {
  const profile = cityProfile(city);

  const boi =
    boiRows.find((row) => normalizeRegionName(row.region) === normalizeRegionName(profile.boiRegion)) || boiRows[0] || null;
  const milho = pickRow(milhoRows, profile.milho);
  const soja = pickRow(sojaRows, profile.soja);

  return {
    updatedAt: publishedAt || new Date().toLocaleString('pt-BR'),
    status: 'Atualizado',
    location: profile.label,
    arroba: boi
      ? {
          value: moneyArroba(boi.cash),
          term: moneyArroba(boi.term),
          source: 'Scot Consultoria',
          region: boi.region,
          note: `Última cotação publicada para ${boi.region}`,
        }
      : null,
    futuro: null,
    graos: {
      milho: milho ? moneySaca(milho.price) : null,
      milhoPraca: milho ? `${milho.city} (${milho.uf})` : null,
      milhoNote: milho?.note || '',
      soja: soja ? moneySaca(soja.price) : null,
      sojaPraca: soja ? `${soja.city} (${soja.uf})` : null,
      sojaNote: soja?.note || '',
      source: 'Scot Consultoria / AgRural',
    },
    noticias: news,
    sources: [
      { name: 'Scot Consultoria - Boi gordo', url: URL_BOI },
      { name: 'Scot Consultoria - Grãos', url: URL_GRAOS },
      { name: 'Google News', url: 'https://news.google.com/' },
    ],
    warning:
      'Arroba física, milho e soja exibem a última cotação publicada disponível. Mercado futuro será conectado em uma próxima atualização.',
  };
}

export default async (request) => {
  try {
    const url = new URL(request.url);
    const city = url.searchParams.get('city') || 'jatai';

    const [boiHtml, graosHtml, newsXml] = await Promise.all([
      fetchText(URL_BOI),
      fetchText(URL_GRAOS),
      fetchText(URL_NEWS),
    ]);

    const boiLines = toLines(stripHtmlWithLines(boiHtml));
    const graosLines = toLines(stripHtmlWithLines(graosHtml));

    const boiRows = parseBoiRows(boiLines);
    const { milhoRows, sojaRows } = parseGraos(graosLines);
    const news = extractNewsItems(newsXml, 6);
    const publishedAt = extractPublishedAt(boiLines) || extractPublishedAt(graosLines);

    return json(
      buildPayload({
        city,
        boiRows,
        milhoRows,
        sojaRows,
        news,
        publishedAt,
      })
    );
  } catch (error) {
    return json(
      {
        updatedAt: new Date().toLocaleString('pt-BR'),
        status: 'Contingência',
        location: 'Jataí (GO)',
        warning: 'Não foi possível buscar as últimas cotações publicadas neste momento.',
        debug: error instanceof Error ? error.message : 'Erro desconhecido',
        arroba: null,
        futuro: null,
        graos: {
          milho: null,
          milhoPraca: null,
          milhoNote: '',
          soja: null,
          sojaPraca: null,
          sojaNote: '',
          source: 'Scot Consultoria / AgRural',
        },
        noticias: [
          {
            title: 'Mercado pecuário em monitoramento',
            link: 'https://news.google.com/',
            source: 'Boi Agora',
          },
        ],
        sources: [
          { name: 'Scot Consultoria - Boi gordo', url: URL_BOI },
          { name: 'Scot Consultoria - Grãos', url: URL_GRAOS },
        ],
      },
      200
    );
  }
};
