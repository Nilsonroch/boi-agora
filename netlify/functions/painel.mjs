export default async (request, context) => {
  const fallback = {
    updatedAt: new Date().toLocaleString("pt-BR"),
    status: "Exibindo contingência",
    location: "Jataí (GO)",
    arroba: {
      value: "R$ 295,00",
      change: "0,00%",
      source: "Contingência",
    },
    futuro: {
      value: "R$ 310,00",
      change: "0,00%",
      source: "Contingência",
    },
    graos: {
      milho: "R$ 68,00",
      soja: "R$ 128,00",
      source: "Contingência",
    },
    noticias: [
      {
        title: "Mercado pecuário em monitoramento",
        link: "#",
        source: "Boi Agora",
      },
      {
        title: "Arroba e grãos aguardando atualização externa",
        link: "#",
        source: "Boi Agora",
      },
      {
        title: "Painel operando em modo de contingência",
        link: "#",
        source: "Boi Agora",
      },
    ],
    warning:
      "Não foi possível atualizar o painel agora. O painel segue funcionando com dados de contingência.",
  };

  return new Response(JSON.stringify(fallback), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
