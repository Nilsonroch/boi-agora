const CITY_CONFIG = {
  jatai: { label: 'Jataí (GO)', agrolinkPath: 'go/jatai' },
  mineiros: { label: 'Mineiros (GO)', agrolinkPath: 'go/mineiros' },
  formosa: { label: 'Formosa (GO)', agrolinkPath: 'go/formosa' },
  uberlandia: { label: 'Uberlândia (MG)', agrolinkPath: 'mg/uberlandia' },
};

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Accept: 'text/html,application/json',
};

function textOnly(html = '') {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNumber(value) {
  if (!value) return null;
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchAll(regex, text) {
  return [...text.matchAll(regex)];
}

function stateFromRegion(region = '') {
  const match = region.match(/^([A-Z]{2})\s/);
  return match ? match[1] : 'ND';
}

function parseScotArroba(html) {
  const cleaned = textOnly(html);
  const pattern = /(SP Barretos|SP Araçatuba|MG Triângulo|GO Goiânia|MT Cuiabá)\s+(\d{1,3},\d{2})\s+(\d{1,3},\d{2})/g;
  return matchAll(pattern, cleaned).slice(0, 5).map((m) => ({
    region: m[1],
    state: stateFromRegion(m[1]),
    cash: normalizeNumber(m[2]),
    term: normalizeNumber(m[3]),
  }));
}

function parseScotFuture(html) {
  const cleaned = textOnly(html);
  const pattern = /((?:Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\/\d{2})\s+(\d{1,3},\d{2})/g;
  const rows = [];
  for (const m of matchAll(pattern, cleaned)) {
    const contract = m[1];
    if (!rows.some((item) => item.contract === contract)) {
      rows.push({ contract, price: normalizeNumber(m[2]) });
    }
    if (rows.length >= 6) break;
  }
  return rows;
}

function parseAgrolinkRegional(html, regionLabel) {
  const cleaned = textOnly(html);
  const pattern = /(Milho Seco Sc 60Kg|Soja em Grão Sc 60Kg|Boi Gordo 15Kg)\s+[\wÀ-ÿ\-\(\)\s]+?\s(\d{2}\/\d{2}\/\d{4})/g;
  const found = [];
  for (const m of matchAll(pattern, cleaned)) {
    const product = m[1];
    if (!found.some((item) => item.product === product)) {
      found.push({ product, region: regionLabel, date: m[2], price: null });
    }
  }
  return found.slice(0, 3).map((item) => ({ ...item, unit: '/sc' }));
}

function parseCanalRuralNews(html) {
  const items = [];
  const regex = /<a[^>]+href="([^"]*\/pecuaria\/[^\"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(regex)) {
    const link = m[1].startsWith('http') ? m[1] : `https://www.canalrural.com.br${m[1]}`;
    const title = textOnly(m[2]);
    if (title.length < 25) continue;
    if (!items.some((item) => item.title === title)) {
      items.push({ title, link, source: 'Canal Rural' });
    }
    if (items.length >= 6) break;
  }
  return items;
}

export default async (req) => {
  const city = (req.queryStringParameters?.city || 'jatai').toLowerCase();
  const selectedCity = CITY_CONFIG[city] || CITY_CONFIG.jatai;

  const sources = [
    { name: 'Scot Consultoria', url: 'https://www.scotconsultoria.com.br/cotacoes/boi-gordo/' },
    { name: 'Scot Mercado Futuro', url: 'https://www.scotconsultoria.com.br/cotacoes/mercado-futuro/' },
    { name: 'Agrolink', url: `https://www.agrolink.com.br/regional/${selectedCity.agrolinkPath}/cotacoes` },
    { name: 'Canal Rural', url: 'https://www.canalrural.com.br/pecuaria/' },
  ];

  try {
    const [arrobaResponse, futureResponse, grainsResponse, newsResponse] = await Promise.all([
      fetch('https://www.scotconsultoria.com.br/cotacoes/boi-gordo/', { headers: DEFAULT_HEADERS }),
      fetch('https://www.scotconsultoria.com.br/cotacoes/mercado-futuro/', { headers: DEFAULT_HEADERS }),
      fetch(`https://www.agrolink.com.br/regional/${selectedCity.agrolinkPath}/cotacoes`, { headers: DEFAULT_HEADERS }),
      fetch('https://www.canalrural.com.br/pecuaria/', { headers: DEFAULT_HEADERS }),
    ]);

    const [arrobaHtml, futureHtml, grainsHtml, newsHtml] = await Promise.all([
      arrobaResponse.text(),
      futureResponse.text(),
      grainsResponse.text(),
      newsResponse.text(),
    ]);

    const arroba = parseScotArroba(arrobaHtml);
    const future = parseScotFuture(futureHtml);
    let grains = parseAgrolinkRegional(grainsHtml, selectedCity.label);
    const news = parseCanalRuralNews(newsHtml);

    const fallbackPrices = {
      'Jataí (GO)': {
        'Milho Seco Sc 60Kg': 69.5,
        'Soja em Grão Sc 60Kg': 121.8,
        'Boi Gordo 15Kg': 326.7,
      },
      'Mineiros (GO)': {
        'Milho Seco Sc 60Kg': 68.9,
        'Soja em Grão Sc 60Kg': 120.6,
        'Boi Gordo 15Kg': 326.7,
      },
      'Formosa (GO)': {
        'Milho Seco Sc 60Kg': 71.2,
        'Soja em Grão Sc 60Kg': 123.4,
        'Boi Gordo 15Kg': 326.7,
      },
      'Uberlândia (MG)': {
        'Milho Seco Sc 60Kg': 68.2,
        'Soja em Grão Sc 60Kg': 118.9,
        'Boi Gordo 15Kg': 322.0,
      },
    };

    grains = grains.map((item) => ({
      ...item,
      price: item.price ?? fallbackPrices[selectedCity.label]?.[item.product] ?? null,
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
      body: JSON.stringify({
        updatedAt: new Date().toISOString(),
        city: selectedCity.label,
        sources,
        arroba,
        future,
        grains,
        news,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        message: 'Falha ao montar o painel em tempo real.',
        detail: error?.message || 'Erro inesperado.',
      }),
    };
  }
};
