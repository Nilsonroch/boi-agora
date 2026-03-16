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
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      referer: 'https://www.google.com/',
      pragma: 'no-cache',
      'cache-control': 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar ${url}: ${response.status}`);
  }

  return response.text();
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

function parsePublishedAt(text) {
  const decoded = decodeEntities(text);

  const match =
    decoded.match(/([A-Za-zçÇãõáéíóúâêô-]+,\s*\d{1,2}\s+de\s+[A-Za-zçÇãõáéíóúâêô]+\s+de\s+\d{4}\s*-\s*\d{2}h\d{2})/i) ||
    decoded.match(/(\d{1,2}\/\d{1,2}\/\d{4}\s*-\s*\d{2}:\d{2}:\d{2})/) ||
    decoded.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);

  return match ? match[1] : new Date().toLocaleString('pt-BR');
}

// Arroba física por praça
function parseBoiByPlaza(text, plaza) {
  const decoded = decodeEntities(text);

  if (plaza === 'sao-paulo') {
    const china = decoded.match(/São Paulo\s+(\d{1,3},\d{2})\s+(\d{1,3},\d{2})/);
    const fisico = decoded.match(/SP Barretos\s+(\d{1,3},\d{2})\s+(\d{1,3},\d{2})/);

    if (fisico) {
      return {
        region: 'SP Barretos',
        value: brToNumber(fisico[1]),
        term: brToNumber(fisico[2]),
        note: 'Última cotação publicada do mercado físico em São Paulo',
      };
    }

    if (china) {
      return {
        region: 'São Paulo',
        value: brToNumber(china[1]),
        term: brToNumber(china[2]),
        note: 'Última cotação publicada para boi China a prazo em São Paulo',
      };
    }

    return null;
  }

  const fisico = decoded.match(/GO Goiânia\s+(\d{1,3},\d{2})\s+(\d{1,3},\d{2})/);
  const china = decoded.match(/Goiás\s+(\d{1,3},\d{2})\s+(\d{1,3},\d{2})/);

  if (fisico) {
    return {
      region: 'GO Goiânia',
      value: brToNumber(fisico[1]),
      term: brToNumber(fisico[2]),
      note: 'Última cotação publicada do mercado físico em Goiás',
    };
  }

  if (china) {
    return {
      region: 'Goiás',
      value: brToNumber(china[1]),
      term: brToNumber(china[2]),
      note: 'Última cotação publicada para boi China a prazo em Goiás',
    };
  }

  return null;
}

// Milho e soja por praça
function parseGraosByPlaza(text, plaza) {
  const decoded = decodeEntities(text);

  if (plaza === 'sao-paulo') {
    const milho = decoded.match(/SP\s+São Paulo\s+(\d{1,3},\d{2})/);
    const soja = decoded.match(/SP\s+Santos\s+(\d{1,3},\d{2})/);

    return {
      milho: milho
        ? {
            value: brToNumber(milho[1]),
            praca: 'São Paulo (SP)',
            note: 'Última cotação publicada de milho para São Paulo',
          }
        : null,
      soja: soja
        ? {
            value: brToNumber(soja[1]),
            praca: 'Santos (SP)',
            note: 'Última cotação publicada de soja para Santos (SP)',
          }
        : null,
    };
  }

  const milho = decoded.match(/GO\s+Itumbiara\s+(\d{1,3},\d{2})/);
  const soja = decoded.match(/GO\s+Mineiros\s+(\d{1,3},\d{2})\s+Rio Verde\s+(\d{1,3},\d{2})\s+Jata[ií]\s+(\d{1,3},\d{2})/);

  return {
    milho: milho
      ? {
          value: brToNumber(milho[1]),
          praca: 'Itumbiara (GO)',
          note: 'Última cotação publicada de milho disponível em Goiás',
        }
      : null,
    soja: soja
      ? {
          value: brToNumber(soja[3]),
          praca: 'Jataí (GO)',
          note: 'Última cotação publicada de soja para Jataí (GO)',
        }
      : null,
  };
}

// Mercado futuro
function parseFuturo(text) {
  const decoded = decodeEntities(text);

  const match = decoded.match(
    /(Mar\/\d{2}|Abr\/\d{2}|Mai\/\d{2}|Jun\/\d{2}|Jul\/\d{2}|Ago\/\d{2})\s+(\d{1,3},\d{2})\s+(\d{1,3},\d{2})\s+(\d+)\s+(-?\d{1,3},\d{2})\s+(\d{1,3},\d{2})\s+(\d{1,3},\d{2})/
  );

  if (!match) return null;

  return {
    contract: match[1],
    prevAdjust: brToNumber(match[2]),
    adjust: brToNumber(match[3]),
    openInterest: Number(match[4]),
    changePercent: brToNumber(match[5]),
    usd: brToNumber(match[6]),
    projection: brToNumber(match[7]),
    note: 'Último ajuste publicado do mercado futuro do boi gordo',
  };
}

function buildPayload(plaza, boi, futuro, graos, noticias, updatedAt) {
  return {
    updatedAt,
    status: 'Atualizado',
    location: plaza === 'sao-paulo' ? 'São Paulo' : 'Goiás',
    arroba: boi
      ? {
          value: moneyArroba(boi.value),
          term: moneyArroba(boi.term),
          source: 'Scot Consultoria',
          region: boi.region,
          note: boi.note,
        }
      : null,
    futuro: futuro
      ? {
          contract: futuro.contract,
          value: moneyArroba(futuro.adjust),
          change: percentText(futuro.changePercent),
          projection: moneyArroba(futuro.projection),
          source: 'Scot Consultoria / B3',
          note: futuro.note,
        }
      : null,
    graos: {
      milho: graos.milho ? moneySaca(graos.milho.value) : null,
      milhoPraca: graos.milho?.praca || null,
      milhoNote: graos.milho?.note || '',
      soja: graos.soja ? moneySaca(graos.soja.value) : null,
      sojaPraca: graos.soja?.praca || null,
      sojaNote: graos.soja?.note || '',
      source: 'Scot Consultoria / AgRural',
    },
    noticias,
    sources: [
      { name: 'Scot Consultoria - Boi gordo', url: URL_BOI },
      { name: 'Scot Consultoria - Grãos', url: URL_GRAOS },
      { name: 'Scot Consultoria - Mercado futuro', url: URL_FUTURO },
      { name: 'Google News', url: 'https://news.google.com/' },
    ],
    warning: '',
  };
}

export default async (request) => {
  try {
    const url = new URL(request.url);
    const plaza = url.searchParams.get('plaza') === 'sao-paulo' ? 'sao-paulo' : 'goias';

    const [boiHtml, graosHtml, futuroHtml, newsXml] = await Promise.all([
      fetchText(URL_BOI),
      fetchText(URL_GRAOS),
      fetchText(URL_FUTURO),
      fetchText(URL_NEWS),
    ]);

    const updatedAt = parsePublishedAt(boiHtml);
    const boi = parseBoiByPlaza(boiHtml, plaza);
    const graos = parseGraosByPlaza(graosHtml, plaza);
    const futuro = parseFuturo(futuroHtml);
    const noticias = extractNewsItems(newsXml, 6);

    return json(buildPayload(plaza, boi, futuro, graos, noticias, updatedAt));
  } catch (error) {
    return json(
      {
        updatedAt: new Date().toLocaleString('pt-BR'),
        status: 'Contingência',
        location: 'Goiás',
        warning: 'Não foi possível buscar as cotações no momento.',
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
          { name: 'Scot Consultoria - Mercado futuro', url: URL_FUTURO },
        ],
      },
      200
    );
  }
};
