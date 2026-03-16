const URL_INDICADORES = 'https://www.scotconsultoria.com.br/cotacoes/indicadores/?ref=foo';
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
  if (!value) return null;
  const num = Number(String(value).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(num) ? num : null;
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
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  const signal = num > 0 ? '+' : '';
  return `${signal}${num.toFixed(2).replace('.', ',')}%`;
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
  return line || new Date().toLocaleString('pt-BR');
}

function normalize(text = '') {
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

function parseIndicadores(lines) {
  const rows = [];
  const allowed = [
    'SP Barretos',
    'SP Araçatuba',
    'MG Triângulo',
    'MG BH',
    'MG B.Horizonte',
    'MG Norte',
    'MG Sul',
    'GO Goiânia',
    'GO Reg. Sul',
    'MS Dourados',
    'MS C. Grande',
    'MT Cuiabá',
    'MT Cuiabá*',
    'MT Sudeste',
    'MT Sudoeste',
    'MT Norte',
  ];

  for (const line of lines) {
    for (const region of allowed) {
      const escaped = region
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\ /g, '\\s+');

      const regex = new RegExp(`^${escaped}\\s+(\\d{1,3},\\d{2})\\s+(\\d{1,3},\\d{2})`);
      const match = line.match(regex);
      if (match) {
        rows.push({
          region: normalize(region.replace('MG BH', 'MG B.Horizonte')),
          today: brToNumber(match[1]),
          yesterday: brToNumber(match[2]),
        });
        break;
      }
    }
  }

  return rows;
}

function parseGraos(lines) {
  const milhoRows = [];
  const sojaRows = [];
  let mode = '';
  let currentUf = '';

  for (const rawLine of lines) {
    const line = normalize(rawLine);

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
    if (/^Acompanhe o mercado/i.test(line)) break;

    let match = line.match(/^([A-Z]{2})\s+(.+?)\s+(\d{1,3},\d{2})$/);
    if (match) {
      currentUf = match[1];
      const row = {
        uf: currentUf,
        city: normalize(match[2]),
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
        city: normalize(match[1]),
        price: brToNumber(match[2]),
      };
      if (mode === 'milho') milhoRows.push(row);
      if (mode === 'soja') sojaRows.push(row);
    }
  }

  return { milhoRows, sojaRows };
}

function parseFuturo(lines) {
  const rows = [];

  for (const line of lines) {
    const match = line.match(
      /^([A-Za-z]{3}\/\d{2})\s+(\d{1,3},\d{2})\s+(\d{1,3},\d{2})\s+(\d+)\s+(-?\d{1,3},\d{2})\s+(\d{1,3},\d{2})\s+(\d{1,3},\d{2})$/
    );

    if (!match) continue;

    rows.push({
      contract: match[1],
      prevAdjust: brToNumber(match[2]),
      adjust: brToNumber(match[3]),
      openInterest: Number(match[4]),
      changePercent: brToNumber(match[5]),
      usd: brToNumber(match[6]),
      projection: brToNumber(match[7]),
    });
  }

  return rows;
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
        { uf: 'GO', city: 'Rio Verde', note: 'Última referência publicada mais próxima disponível em Goiás' },
        { uf: 'GO', city: 'Itumbiara', note: 'Última referência publicada alternativa em Goiás' },
      ],
      soja: [
        { uf: 'GO', city: 'Jataí', note: 'Cotação publicada para Jataí (GO)' },
        { uf: 'GO', city: 'Rio Verde', note: 'Última referência publicada mais próxima disponível em Goiás' },
      ],
    },
    mineiros: {
      label: 'Mineiros (GO)',
      boiRegion: 'GO Reg. Sul',
      milho: [
        { uf: 'GO', city: 'Rio Verde', note: 'Última referência publicada mais próxima disponível em Goiás' },
        { uf: 'GO', city: 'Itumbiara', note: 'Última referência publicada alternativa em Goiás' },
      ],
      soja: [{ uf: 'GO', city: 'Mineiros', note: 'Cotação publicada para Mineiros (GO)' }],
    },
    formosa: {
      label: 'Formosa (GO)',
      boiRegion: 'GO Goiânia',
      milho: [
        { uf: 'GO', city: 'Itumbiara', note: 'Última referência publicada disponível em Goiás' },
      ],
      soja: [
        { uf: 'DF', city: 'Brasília', note: 'Última referência publicada mais próxima disponível' },
        { uf: 'GO', city: 'Rio Verde', note: 'Última referência publicada alternativa em Goiás' },
      ],
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
      (row) => row.uf.toUpperCase() === pref.uf.toUpperCase() && normalize(row.city).toLowerCase() === normalize(pref.city).toLowerCase()
    );
    if (found) return { ...found, note: pref.note || '' };
  }
  return rows[0] ? { ...rows[0], note: 'Última referência publicada disponível' } : null;
}

function buildPayload({ city, indicadoresRows, milhoRows, sojaRows, futuroRows, news, publishedAt }) {
  const profile = cityProfile(city);

  const arroba =
    indicadoresRows.find((row) => normalize(row.region) === normalize(profile.boiRegion)) ||
    indicadoresRows[0] ||
    null;

  const milho = pickRow(milhoRows, profile.milho);
  const soja = pickRow(sojaRows, profile.soja);
  const futuro = futuroRows[0] || null;

  return {
    updatedAt: publishedAt,
    status: 'Atualizado',
    location: profile.label,
    arroba: arroba
      ? {
          value: moneyArroba(arroba.today),
          yesterday: moneyArroba(arroba.yesterday),
          source: 'Scot Consultoria',
          region: arroba.region,
          note: `Última cotação publicada para ${arroba.region}`,
        }
      : null,
    futuro: futuro
      ? {
          contract: futuro.contract,
          value: moneyArroba(futuro.adjust),
          change: percentText(futuro.changePercent),
          projection: moneyArroba(futuro.projection),
          source: 'Scot Consultoria / B3',
          note: 'Último ajuste publicado do mercado futuro do boi gordo',
        }
      : null,
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
      { name: 'Scot Consultoria - Indicadores', url: URL_INDICADORES },
      { name: 'Scot Consultoria - Grãos', url: URL_GRAOS },
      { name: 'Scot Consultoria - Mercado futuro', url: URL_FUTURO },
      { name: 'Google News', url: 'https://news.google.com/' },
    ],
    warning: '',
    diagnostics: {
      indicadoresRows: indicadoresRows.length,
      milhoRows: milhoRows.length,
      sojaRows: sojaRows.length,
      futuroRows: futuroRows.length,
      selectedArroba: arroba?.region || null,
      selectedMilho: milho ? `${milho.city} (${milho.uf})` : null,
      selectedSoja: soja ? `${soja.city} (${soja.uf})` : null,
      selectedFuturo: futuro?.contract || null,
    },
  };
}

export default async (request) => {
  try {
    const url = new URL(request.url);
    const city = url.searchParams.get('city') || 'jatai';

    const [indicadoresHtml, graosHtml, futuroHtml, newsXml] = await Promise.all([
      fetchText(URL_INDICADORES),
      fetchText(URL_GRAOS),
      fetchText(URL_FUTURO),
      fetchText(URL_NEWS),
    ]);

    const indicadoresLines = toLines(stripHtmlWithLines(indicadoresHtml));
    const graosLines = toLines(stripHtmlWithLines(graosHtml));
    const futuroLines = toLines(stripHtmlWithLines(futuroHtml));

    const indicadoresRows = parseIndicadores(indicadoresLines);
    const { milhoRows, sojaRows } = parseGraos(graosLines);
    const futuroRows = parseFuturo(futuroLines);
    const news = extractNewsItems(newsXml, 6);

    const publishedAt =
      extractPublishedAt(indicadoresLines) ||
      extractPublishedAt(graosLines) ||
      extractPublishedAt(futuroLines) ||
      new Date().toLocaleString('pt-BR');

    return json(
      buildPayload({
        city,
        indicadoresRows,
        milhoRows,
        sojaRows,
        futuroRows,
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
          { name: 'Scot Consultoria - Indicadores', url: URL_INDICADORES },
          { name: 'Scot Consultoria - Grãos', url: URL_GRAOS },
          { name: 'Scot Consultoria - Mercado futuro', url: URL_FUTURO },
        ],
      },
      200
    );
  }
};
