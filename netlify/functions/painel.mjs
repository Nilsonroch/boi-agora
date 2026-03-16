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

function extractGoogleNewsItems(xml, maxItems = 6) {
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

async function getNoticias() {
  const rssUrl =
    "https://news.google.com/rss/search?q=pecu%C3%A1ria+de+corte+OR+boi+gordo+OR+bovinocultura+Brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419";

  const xml = await fetchText(rssUrl);
  const noticias = extractGoogleNewsItems(xml, 6);

  if (!noticias.length) throw new Error("RSS sem notícias");
  return noticias;
}

export default async () => {
  try {
    const noticias = await getNoticias();

    return json({
      updatedAt: toPtDate(),
      status: "Atualizado",
      location: DEFAULT_LOCATION,
      noticias,
      sources: [
        { name: "Google News", url: "https://news.google.com/" },
        { name: "Canal Rural", url: "https://www.canalrural.com.br/pecuaria/" },
        { name: "Globo Rural", url: "https://globorural.globo.com/" },
        { name: "Compre Rural", url: "https://www.comprerural.com/" },
      ],
      warning:
        "As cotações físicas de arroba, milho e soja estão temporariamente ocultas até a integração com fontes adequadas por praça.",
    });
  } catch (error) {
    return json({
      updatedAt: toPtDate(),
      status: "Contingência",
      location: DEFAULT_LOCATION,
      noticias: [
        {
          title: "Mercado pecuário em monitoramento",
          link: "https://news.google.com/",
          source: "Boi Agora",
        },
      ],
      sources: [{ name: "Google News", url: "https://news.google.com/" }],
      warning: "Não foi possível atualizar as notícias neste momento.",
      debug: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};
