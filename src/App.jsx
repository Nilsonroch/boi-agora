import React, { useEffect, useMemo, useState } from 'react';

function parseISODate(dateString) {
  if (!dateString) return 'Agora';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleString('pt-BR');
}

function toWhatsappLink(message) {
  return `https://wa.me/5562998575050?text=${encodeURIComponent(message)}`;
}

const MOCK_DATA = {
  updatedAt: new Date().toISOString(),
  location: 'Jataí (GO)',
  sources: [
    { name: 'Google News', url: 'https://news.google.com/' },
    { name: 'Canal Rural', url: 'https://www.canalrural.com.br/pecuaria/' },
    { name: 'Globo Rural', url: 'https://globorural.globo.com/' },
    { name: 'Compre Rural', url: 'https://www.comprerural.com/' },
  ],
  noticias: [
    {
      title: 'Mercado pecuário em monitoramento',
      link: 'https://news.google.com/',
      source: 'Boi Agora',
    },
    {
      title: 'Painel aguardando integração com fontes físicas confiáveis',
      link: 'https://news.google.com/',
      source: 'Boi Agora',
    },
  ],
  warning:
    'As cotações físicas de arroba, milho e soja estão temporariamente ocultas até a integração com fontes adequadas por praça.',
};

function App() {
  const [data, setData] = useState(MOCK_DATA);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState('jatai');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);

      try {
        const response = await fetch(`/.netlify/functions/painel?city=${city}`, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Não foi possível atualizar o painel agora.');
        }

        const payload = await response.json();

        if (!cancelled) {
          const merged = { ...MOCK_DATA, ...payload };
          setData(merged);
        }
      } catch {
        if (!cancelled) {
          setData(MOCK_DATA);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();
    const timer = window.setInterval(loadDashboard, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [city, refreshTick]);

  const newsItems = useMemo(() => data.noticias || data.news || [], [data]);

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__brand">
          <img src="/logo-boi-agora.png" alt="Matsuda Link Representações" className="hero__logo" />
          <div>
            <span className="badge">Aplicativo de inteligência de mercado</span>
            <h1>Boi Agora</h1>
            <p>
              Painel de acompanhamento da pecuária com radar de notícias e estrutura pronta para receber
              cotações físicas confiáveis por praça.
            </p>
          </div>
        </div>

        <div className="hero__actions">
          <label className="field">
            <span>Praça monitorada</span>
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="jatai">Jataí GO</option>
              <option value="mineiros">Mineiros GO</option>
              <option value="formosa">Formosa GO</option>
              <option value="uberlandia">Uberlândia MG</option>
            </select>
          </label>

          <button className="primary-button" onClick={() => setRefreshTick((v) => v + 1)}>
            Atualizar agora
          </button>

          <a
            className="secondary-button"
            href={toWhatsappLink('Olá, Nilson. Quero apoio técnico e leitura de mercado pelo app Boi Agora.')}
            target="_blank"
            rel="noreferrer"
          >
            Falar no WhatsApp
          </a>
        </div>
      </header>

      <section className="status-bar">
        <div>
          <strong>Última atualização</strong>
          <span>{parseISODate(data.updatedAt)}</span>
        </div>
        <div>
          <strong>Status</strong>
          <span>{loading ? 'Atualizando dados...' : 'Online'}</span>
        </div>
        <div>
          <strong>Praça monitorada</strong>
          <span>{data.location || 'Jataí (GO)'}</span>
        </div>
      </section>

      <section className="commercial-grid">
        <article className="commercial-card">
          <span className="trend-pill trend-pill--stable">Radar de mercado</span>
          <strong>Informação confiável acima de tudo</strong>
          <p>
            O painel prioriza exibir apenas o que estiver tecnicamente coerente. As cotações físicas serão
            mostradas quando estiverem ligadas a fontes corretas por praça.
          </p>
        </article>

        <article className="commercial-card">
          <span className="trend-pill trend-pill--stable">Atualização contínua</span>
          <strong>Notícias da pecuária em tempo real</strong>
          <p>
            O app já atualiza automaticamente o radar de notícias para manter você informado sobre mercado,
            arroba, exportação, grãos e cenário pecuário.
          </p>
        </article>

        <article className="commercial-card commercial-card--strong">
          <span className="trend-pill trend-pill--stable">Ação comercial</span>
          <strong>Leitura rápida para decisão de compra e venda</strong>
          <p>
            Use o app como central de acompanhamento e acione seu atendimento técnico comercial com um toque.
          </p>
        </article>
      </section>

      <section className="summary-grid">
        <article className="summary-card">
          <span className="summary-card__label">Arroba física</span>
          <strong>Em integração</strong>
          <small>Aguardando fonte por praça</small>
        </article>

        <article className="summary-card">
          <span className="summary-card__label">Mercado futuro do boi</span>
          <strong>Em integração</strong>
          <small>Aguardando fonte validada</small>
        </article>

        <article className="summary-card">
          <span className="summary-card__label">Milho</span>
          <strong>Em integração</strong>
          <small>Aguardando cotação física</small>
        </article>

        <article className="summary-card">
          <span className="summary-card__label">Soja</span>
          <strong>Em integração</strong>
          <small>Aguardando cotação física</small>
        </article>
      </section>

      <div className="market-note">
        Em breve este painel exibirá cotações físicas validadas por praça.
      </div>

      <main className="content-grid">
        <section className="panel panel--full">
          <div className="panel__header">
            <div>
              <h2>Painel de cotações</h2>
              <p>Bloco reservado para arroba física, mercado futuro validado, milho e soja por praça.</p>
            </div>
          </div>

          <div className="empty-state">
            <strong>Cotações em preparação</strong>
            <p>
              Este bloco será ativado assim que as fontes corretas de cotação física estiverem conectadas ao app.
            </p>
          </div>
        </section>

        <section className="panel panel--full">
          <div className="panel__header">
            <div>
              <h2>Radar de notícias</h2>
              <p>Últimos destaques da pecuária de corte.</p>
            </div>
          </div>

          <div className="news-list">
            {newsItems.map((item, index) => (
              <a key={`${item.title}-${index}`} className="news-card" href={item.link} target="_blank" rel="noreferrer">
                <span>{item.source}</span>
                <strong>{item.title}</strong>
              </a>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div>
          <strong>Fontes monitoradas</strong>
          <div className="source-list">
            {(data.sources || []).map((source) => (
              <a key={source.name} href={source.url} target="_blank" rel="noreferrer">
                {source.name}
              </a>
            ))}
          </div>
        </div>
        <p>
          Instale o Boi Agora no celular pelo navegador usando a opção de adicionar à tela inicial.
        </p>
      </footer>
    </div>
  );
}

export default App;
