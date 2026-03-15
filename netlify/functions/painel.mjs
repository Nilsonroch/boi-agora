const DEFAULT_LOCATION = "Jataí (GO)";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function toPtDate(value = new Date()) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "America/Sao_Paulo",
    }).format(value);
  } catch {
    return new Date().toLocaleString("pt-BR");
  }
}

function stripHtml(text = "") {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractGoogleNewsItems(xml, maxItems = 5) {
  const items = [];
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

  for (const block of blocks.slice(0, maxItems)) {
    const raw = block[1] || "";
    const title = stripHtml((raw.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "");
    const link = stripHtml((raw.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || "");
    const source =
      stripHtml((raw.match(/<source[^>]*>([\s\S]*?)<\/source>/i) || [])[1] || "") ||
      "Google News";

    if (title && link) items.push({ title, link, source });
  }

  return items;
}

function normalizeMoneyBR(value) {
  if (value == null || value === "") return null;
  const num = Number(value);
  if (!Number.isNaN(num)) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(num);
  }
  return String(value);
}

function formatPercent(value) {
  if (value == null || value === "") return "0,00%";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `${num >= 0 ? "+" : ""}${num.toFixed(2).replace(".", ",")}%`;
}

function fallbackPayload(extra = {}) {
  return {
    updatedAt: toPtDate(),
    status: "Exibindo contingência",
    location: DEFAULT_LOCATION,
    arroba: { value: "R$ 295,00", change: "0,00%", source: "Contingência" },
    futuro: { value: "R$ 310,00", change: "0,00%", source: "Contingência" },
    graos: { milho: "R$ 68,00", soja: "R$ 128,00", source: "Contingência" },
    noticias: [
      { title: "Mercado pecuário em monitoramento", link: "https://news.google.com/", source: "Boi Agora" },
      { title: "Arroba e grãos aguardando atualização externa", link: "https://news.google.com/", source: "Boi Agora" },
      { title: "Painel operando em modo de contingência", link: "https://news.google.com/", source: "Boi Agora" },
    ],
    warning: "Não foi possível atualizar completamente o painel.",
    ...extra,
  };
}

async function fetchText(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "user-agent": "BoiAgora/1.0",
      accept: "*/*",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Falha ao buscar ${url}: ${res.status}`);
  return res.text();
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "user-agent": "BoiAgora/1.0",
      accept: "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Falha ao buscar ${url}: ${res.status}`);
  return res.json();
}

async function getNoticias() {
  const rssUrl =
    "https://news.google.com/rss/search?q=pecu%C3%A1ria+de+corte+OR+boi+gordo+OR+bovinocultura+Brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419";

  const xml = await fetchText(rssUrl);
  const noticias = extractGoogleNewsItems(xml, 5);
  if (!noticias.length) throw new Error("RSS sem notícias");
  return noticias;
}

async function getBrapiQuote(symbol, token) {
  const url = `https://brapi.dev/api/quote/${encodeURIComponent(symbol)}?token=${encodeURIComponent(token)}`;
  const data = await fetchJson(url);
  return {
    raw: data,
    item: data?.results?.[0] || null,
  };
}

export default async () => {
  const token = process.env.BRAPI_TOKEN || "";
  const diagnostics = {
    tokenConfigured: Boolean(token),
    tokenPrefix: token ? `${token.slice(0, 4)}...${token.slice(-3)}` : null,
    testedSymbols: [],
    brapi: {},
    errors: [],
  };

  try {
    const noticias = await getNoticias().catch((err) => {
      diagnostics.errors.push(`noticias: ${err.message}`);
      return fallbackPayload().noticias;
    });

    let boi = null;
    let milho = null;
    let soja = null;

    if (token) {
      const symbols = ["BBOI11", "CORN11", "SOJA3"];
      diagnostics.testedSymbols = symbols;

      for (const symbol of symbols) {
        try {
          const result = await getBrapiQuote(symbol, token);
          diagnostics.brapi[symbol] = {
            ok: true,
            hasResults: Array.isArray(result.raw?.results),
            resultCount: Array.isArray(result.raw?.results) ? result.raw.results.length : 0,
            itemFound: Boolean(result.item),
            price: result.item?.regularMarketPrice ?? null,
            changePercent: result.item?.regularMarketChangePercent ?? null,
            shortName: result.item?.shortName ?? null,
            longName: result.item?.longName ?? null,
          };

          if (symbol === "BBOI11") boi = result.item;
          if (symbol === "CORN11") milho = result.item;
          if (symbol === "SOJA3") soja = result.item;
        } catch (err) {
          diagnostics.brapi[symbol] = {
            ok: false,
            error: err.message,
          };
          diagnostics.errors.push(`${symbol}: ${err.message}`);
        }
      }
    } else {
      diagnostics.errors.push("BRAPI_TOKEN ausente");
    }

    const payload = {
      updatedAt: toPtDate(),
      status: "Atualizado",
      location: DEFAULT_LOCATION,
      arroba: boi
        ? {
            value: normalizeMoneyBR(boi.regularMarketPrice),
            change: formatPercent(boi.regularMarketChangePercent),
            source: "Proxy BBOI11 / B3",
          }
        : {
            value: "R$ 295,00",
            change: "0,00%",
            source: "Contingência",
          },
      futuro: boi
        ? {
            value: normalizeMoneyBR(boi.regularMarketPrice),
            change: formatPercent(boi.regularMarketChangePercent),
            source: "Proxy BBOI11 / B3",
          }
        : {
            value: "R$ 310,00",
            change: "0,00%",
            source: "Contingência",
          },
      graos: {
        milho: milho ? normalizeMoneyBR(milho.regularMarketPrice) : "R$ 68,00",
        soja: soja ? normalizeMoneyBR(soja.regularMarketPrice) : "R$ 128,00",
        source: milho || soja ? "brapi/B3" : "Contingência",
      },
      noticias,
      warning:
        boi || milho || soja
          ? ""
          : "Notícias atualizadas. Cotações seguem em contingência.",
      diagnostics,
    };

    return json(payload);
  } catch (error) {
    return json(
      fallbackPayload({
        warning: "Falha geral na função.",
        diagnostics: {
          ...diagnostics,
          fatalError: error.message,
        },
      }),
      200
    );
  }
};
