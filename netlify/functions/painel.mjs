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

function stripHtmlWithLines(html = '') {
  return html
    .replace(/<\/(tr|p|div|li|h1|h2|h3|h4|br|table|thead|tbody|td|th|section|article)>/gi, '\n')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
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

function percentText(value) {
  const num = brToNumber(value);
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
  const line = lines.find((item) => /\d{1,2} de .+ de \d{4}\s*-\s*\d{2}h\d{2}/i.test(item));
  return line || '';
}

function parseBoiRows(lines) {
  const start = lines.findIndex((l) => l.includes('Mercado Físico -'));
  const end = lines.findIndex((l, i) => i > start && l.includes('Fonte: Scot Consultoria'));

  if (start === -1) return [];

  const rows = [];
  const slice = lines.slice(start, end === -1 ? undefined : end);

  for (const line of slice) {
    const match = line.match(/^(.+?)\s+(\d{1,3},\d{2})\s+(\d{1,3},\d{2})\s+/);
    if (!match) continue;

    const region = match[1].trim();

    if (
      /Mercado Físico|BOI GORDO|Preços Brutos|Funrural|Senar|à vista|base|Image|Estável|Subiu|Desceu|Fonte:/i.test(
        region
      )
    ) {
      continue;
    }

    rows.push({
      region,
      cash: brToNumber(match[2]),
      term: brToNumber(match[3]),
    });
  }

  return rows;
}

function parseGraos(lines) {
  const milhoStart = lines.findIndex((l) => l.startsWith('MILHO -'));
  const sojaStart = lines.findIndex((l) => l.startsWith('SOJA -'));

  const milhoRows = [];
  const sojaRows = [];

  if (milhoStart !== -1) {
    let currentUf = '';
    for (const line of lines.slice(milhoStart + 1, sojaStart === -1 ? undefined : sojaStart)) {
      if (/^Preços médios|^UF Cidade Compra|^\*/i.test(line)) continue;
      if (!line || /^SOJA -/i.test(line)) break;

      let match = line.match(/^([A-Z]{2})\s+(.+?)\s+(\d{1,3},\d{2})$/);
      if (match) {
        currentUf = match[1];
        milhoRows.push({
          uf: currentUf,
          city: match[2].trim(),
          price: brToNumber(match[3]),
        });
        continue;
      }

      match = line.match(/^(.+?)\s+(\d{1,3},\d{2})$/);
      if (match && currentUf) {
        milhoRows.push({
          uf: currentUf,
          city: match[1].trim(),
          price: brToNumber(match[2]),
        });
      }
    }
  }

  if (sojaStart !== -1) {
    let currentUf = '';
    for (const line of lines.slice(sojaStart + 1)) {
      if (/^Preços médios|^UF Cidade Compra|^\*/i.test(line)) continue;
      if (!line || /^Acompanhe o mercado/i.test(line)) break;

      let match = line.match(/^([A-Z]{2})\s+(.+?)\s+(\d{1,3},\d{2})$/);
      if (match) {
        currentUf = match[1];
        sojaRows.push({
          uf: currentUf,
          city: match[2].trim(),
          price: brToNumber(match[3]),
        });
        continue;
      }

      match = line.match(/^(.+?)\s+(\d{1,3},\d{2})$/);
      if (match && currentUf) {
        sojaRows.push({
          uf: currentUf,
          city: match[1].trim(),
          price: brToNumber(match[2]),
        });
      }
    }
  }

  return { milhoRows, sojaRows };
}

function parseFuturo(lines) {
  const start = lines.findIndex((l) => l.startsWith('MERCADO FUTURO DO BOI GORDO -'));
  const end = lines.findIndex((l, i) => i > start && l.includes('Fonte: Scot Consultoria'));

  if (start === -1) return [];

  const rows = [];
  const slice = lines.slice(start + 1, end === -1 ? undefined : end);

  for (const line of slice) {
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
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
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

function cityProfile(city) {
  const key = String(city || 'jatai').toLowerCase();

  const profiles = {
    jatai: {
      label: 'Jataí (GO)',
      boiRegion: 'GO Reg. Sul',
      milho: [
        { uf: 'GO', city: 'Rio Verde', note: 'Referência regional do milho para o sudoeste de Goiás' },
        { uf: 'GO', city: 'Itumbiara', note: 'Referência estadual alternativa do milho em Goiás' },
      ],
      soja: [{ uf: 'GO', city: 'Jataí', note: 'Cotação publicada para Jataí (GO)' }],
    },
    mineiros: {
      label: 'Mineiros (GO)',
      boiRegion: 'GO Reg. Sul',
      milho: [
        { uf: 'GO', city: 'Rio Verde', note: 'Referência regional do milho para o sudoeste de Goiás' },
        { uf: 'GO', city: 'Itumbiara', note: 'Referência estadual alternativa do milho em Goiás' },
      ],
      soja: [{ uf: 'GO', city: 'Mineiros', note: 'Cotação publicada para Mineiros (GO)' }],
    },
    formosa: {
      label: 'Formosa (GO)',
      boiRegion: 'GO Goiânia',
      milho: [
        { uf: 'MG', city: 'Unaí', note: 'Referência regional mais próxima disponível para milho' },
        { uf: 'GO', city: 'Itumbiara', note: 'Referência estadual alternativa em Goiás' },
      ],
      soja: [
        { uf: 'DF', city: 'Brasília', note: 'Referência regional mais próxima disponível para soja' },
        { uf: 'GO', city: 'Rio Verde', note: 'Referência estadual alternativa em Goiás' },
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
      (row) => row.uf.toUpperCase() === pref.uf.toUpperCase() && row.city.toLowerCase() === pref.city.toLowerCase()
    );
    if (found) {
      return { ...found, note: pref.note || '' };
    }
  }
  return null;
}

function buildPayload({ city, boiRows, milhoRows, sojaRows, futuroRows, news, publishedAt }) {
  const profile = cityProfile(city);

  const boi = boiRows.find((row) => row.region === profile.boiRegion) || boiRows[0] || null;
  const milho = pickRow(milhoRows, profile.milho) || milhoRows[0] || null;
  const soja = pickRow(sojaRows, profile.soja) || sojaRows[0] || null;
  const futuro = futuroRows[0] || null;

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
          note:
            boi.region === profile.boiRegion
              ? `Última cotação publicada para ${boi.region}`
              : 'Última cotação publicada disponível',
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
      { name: 'Scot Consultoria - Boi gordo', url: URL_BOI },
      { name: 'Scot Consultoria - Mercado futuro', url: URL_FUTURO },
      { name: 'Scot Consultoria - Grãos', url: URL_GRAOS },
      { name: 'Google News', url: 'https://news.google.com/' },
    ],
    warning: '',
  };
}

export default async (request) => {
  try {
    const url = new URL(request.url);
    const city = url.searchParams.get('city') || 'jatai';

    const [boiHtml, graosHtml, futuroHtml, newsXml] = await Promise.all([
      fetchText(URL_BOI),
      fetchText(URL_GRAOS),
      fetchText(URL_FUTURO),
      fetchText(URL_NEWS),
    ]);

    const boiLines = toLines(stripHtmlWithLines(boiHtml));
    const graosLines = toLines(stripHtmlWithLines(graosHtml));
    const futuroLines = toLines(stripHtmlWithLines(futuroHtml));

    const boiRows = parseBoiRows(boiLines);
    const { milhoRows, sojaRows } = parseGraos(graosLines);
    const futuroRows = parseFuturo(futuroLines);
    const news = extractNewsItems(newsXml, 6);

    const publishedAt =
      extractPublishedAt(boiLines) || extractPublishedAt(graosLines) || extractPublishedAt(futuroLines);

    return json(
      buildPayload({
        city,
        boiRows,
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
        noticias: [
          {
            title: 'Mercado pecuário em monitoramento',
            link: 'https://news.google.com/',
            source: 'Boi Agora',
          },
        ],
        sources: [
          { name: 'Scot Consultoria - Boi gordo', url: URL_BOI },
          { name: 'Scot Consultoria - Mercado futuro', url: URL_FUTURO },
          { name: 'Scot Consultoria - Grãos', url: URL_GRAOS },
        ],
      },
      200
    );
  }
};
