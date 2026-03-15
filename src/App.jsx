import React, { useEffect, useMemo, useState } from 'react';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
});

function formatCurrency(value, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${currency.format(Number(value))}${suffix}`;
}

function parseISODate(dateString) {
  if (!dateString) return 'Agora';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleString('pt-BR');
}

function toWhatsappLink(message) {
  return `https://wa.me/5562998575050?text=${encodeURIComponent(message)}`;
}

function buildHistoryPoint(payload) {
  return {
    timestamp: payload.updatedAt || new Date().toISOString(),
    arroba: Number(payload.arroba?.[0]?.cash || 0),
    futuro: Number(payload.future?.[0]?.price || 0),
    milho: Number(payload.grains?.find((item) => /milho/i.test(item.product))?.price || 0),
    soja: Number(payload.grains?.find((item) => /soja/i.test(item.product))?.price || 0),
  };
}

function saveHistory(city, point) {
  try {
    const key = `boi-agora-history-${city}`;
    const previous = JSON.parse(window.localStorage.getItem(key) || '[]');
    const next = [...previous, point]
      .filter((item) => item.arroba || item.futuro || item.milho || item.soja)
      .slice(-12);
    window.localStorage.setItem(key, JSON.stringify(next));
    return next;
  } catch {
    return [point];
  }
}

function readHistory(city) {
  try {
    return JSON.parse(window.localStorage.getItem(`boi-agora-history-${city}`) || '[]');
  } catch {
    return [];
  }
}

function deltaInfo(current, previous) {
  if (!current || !previous) return { direction: 'stable', absolute: 0, label: 'Sem base comparativa' };
  const diff = Number(current) - Number(previous);
  if (!Number.isFinite(diff) || diff === 0) {
    return { direction: 'stable', absolute: 0, label: 'Mercado estável' };
  }
  return {
    direction: diff > 0 ? 'up' : 'down',
    absolute: Math.abs(diff),
    label: diff > 0 ? 'Alta no comparativo local' : 'Baixa no comparativo local',
  };
}

function MiniChart({ data, dataKey, title, suffix = '' }) {
  const points = data.filter((item) => Number(item?.[dataKey]) > 0);

  if (points.length < 2) {
    return (
      <div className="chart-empty">
        <strong>{title}</strong>
        <span>O gráfico será preenchido conforme o aplicativo for sendo acessado e atualizado.</span>
      </div>
    );
  }

  const values = points.map((item) => Number(item[dataKey]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 100;
  const height = 42;

  const polyline = points
    .map((item, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((Number(item[dataKey]) - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  const latest = values[values.length - 1];

  return (
    <div className="chart-card">
      <div className="chart-card__header">
        <strong>{title}</strong>
        <span>{formatCurrency(latest, suffix)}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="mini-chart">
        <polyline fill="none" stroke="currentColor" strokeWidth="2.8" points={polyline} />
      </svg>
      <small>
        Mínimo {formatCurrency(min, suffix)} • Máximo {formatCurrency(max, suffix)}
      </small>
    </div>
  );
}

const MOCK_DATA = {
  updatedAt: new Date().toISOString(),
  sources: [
    { name: 'Scot Consultoria', url: 'https://www.scotconsultoria.com.br/cotacoes/boi-gordo/' },
    { name: 'B3', url: 'https://www.b3.com.br/pt_br/produtos-e-servicos/negociacao/commodities/' },
    { name: 'Agrolink', url: 'https://www.agrolink.com.br/cotacoes/' },
    { name: 'Canal Rural', url: 'https://www.canalrural.com.br/pecuaria/' },
  ],
  arroba: [
    { region: 'GO Goiânia', state: 'GO', cash: 326.5, term: 330.0 },
    { region: 'SP Barretos', state: 'SP', cash: 343.5, term: 347.0 },
    { region: 'MG Triângulo', state: 'MG', cash: 322.0, term: 325.0 },
  ],
  future: [
    { contract: 'Abr/26', price: 343.1 },
    { contract: 'Mai/26', price: 338.4 },
    { contract: 'Jun/26', price: 334.8 },
  ],
  grains: [
    { product: 'Milho Seco Sc 60Kg', region: 'Jataí (GO)', price: 69.5, unit: '/sc' },
    { product: 'Soja em Grão Sc 60Kg', region: 'Jataí (GO)', price: 121.8, unit: '/sc' },
    { product: 'Milho Seco Sc 60Kg', region: 'Uberlândia (MG)', price: 68.2, unit: '/sc' },
  ],
  news: [
    {
      title: 'Exportações de carne bovina seguem fortes e sustentam mercado do boi',
      link: 'https://www.canalrural.com.br/pecuaria/',
      source: 'Canal Rural',
    },
    {
      title: 'Planejamento forrageiro ganha força no ciclo de alta da pecuária',
      link: 'https://www.canalrural.com.br/pecuaria/',
      source: 'Canal Rural',
    },
  ],
};

function App() {
  const [data, setData] = useState(MOCK_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [city, setCity] = useState('jatai');
  const [stateFilter, setStateFilter] = useState('TODOS');
  const [refreshTick, setRefreshTick] = useState(0);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory(readHistory(city));
  }, [city]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`/.netlify/functions/dashboard?city=${city}`, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Não foi possível atualizar o painel agora.');
        }

        const payload = await response.json();
        if (!cancelled) {
          const merged = { ...MOCK_DATA, ...payload };
          setData(merged);
          setHistory(saveHistory(city, buildHistoryPoint(merged)));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Falha ao atualizar os dados.');
          setData(MOCK_DATA);
          setHistory(saveHistory(city, buildHistoryPoint(MOCK_DATA)));
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

  const filteredArroba = useMemo(() => {
    if (stateFilter === 'TODOS') return data.arroba || [];
    return (data.arroba || []).filter((item) => item.state === stateFilter || item.region?.startsWith(`${stateFilter} `));
  }, [data.arroba, stateFilter]);

  const summary = useMemo(() => {
    const bestArroba = [...filteredArroba].sort((a, b) => (b.cash || 0) - (a.cash || 0))[0];
    const firstFuture = data.future?.[0];
    const milho = data.grains?.find((item) => /milho/i.test(item.product));
    const soja = data.grains?.find((item) => /soja/i.test(item.product));

    return {
      bestArroba,
      firstFuture,
      milho,
      soja,
    };
  }, [data, filteredArroba]);

  const alerts = useMemo(() => {
    const current = history[history.length - 1];
    const previous = history[history.length - 2];
    return {
      arroba: deltaInfo(current?.arroba, previous?.arroba),
      futuro: deltaInfo(current?.futuro, previous?.futuro),
      milho: deltaInfo(current?.milho, previous?.milho),
    };
  }, [history]);

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__brand">
          <img src="/logo-boi-agora.png" alt="Matsuda Link Representações" className="hero__logo" />
          <div>
            <span className="badge">Aplicativo de inteligência de mercado</span>
            <h1>Boi Agora</h1>
            <p>
              Painel vivo da pecuária com preço da arroba, mercado futuro, grãos e notícias estratégicas
              sempre que o aplicativo for acessado.
            </p>
          </div>
        </div>

        <div className="hero__actions">
          <label className="field">
            <span>Praça de grãos</span>
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="jatai">Jataí GO</option>
              <option value="mineiros">Mineiros GO</option>
              <option value="formosa">Formosa GO</option>
              <option value="uberlandia">Uberlândia MG</option>
            </select>
          </label>

          <label className="field">
            <span>Filtro por estado da arroba</span>
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              <option value="TODOS">Todos</option>
              <option value="GO">Goiás</option>
              <option value="SP">São Paulo</option>
              <option value="MG">Minas Gerais</option>
              <option value="MT">Mato Grosso</option>
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
          <span>{loading ? 'Atualizando dados...' : error ? 'Exibindo contingência' : 'Online'}</span>
        </div>
        <div>
          <strong>Praça monitorada</strong>
          <span>{data.city || 'Jataí (GO)'}</span>
        </div>
      </section>

      {error ? <div className="alert">{error} O painel segue funcionando com dados de contingência.</div> : null}

      <section className="commercial-grid">
        <article className="commercial-card">
          <span className={`trend-pill trend-pill--${alerts.arroba.direction}`}>
            {alerts.arroba.direction === 'up' ? 'Alerta de alta' : alerts.arroba.direction === 'down' ? 'Alerta de baixa' : 'Sem oscilação'}
          </span>
          <strong>{alerts.arroba.label}</strong>
          <p>
            A arroba está em {formatCurrency(summary.bestArroba?.cash, '/@')} na melhor praça filtrada. Use esse sinal para
            leitura de venda, retenção ou reposição.
          </p>
        </article>

        <article className="commercial-card">
          <span className={`trend-pill trend-pill--${alerts.futuro.direction}`}>Mercado futuro</span>
          <strong>{summary.firstFuture?.contract || 'Sem contrato disponível'}</strong>
          <p>
            Primeiro vencimento em {formatCurrency(summary.firstFuture?.price, '/@')}. Acompanhe tendência e hedge com atualização local.
          </p>
        </article>

        <article className="commercial-card commercial-card--strong">
          <span className="trend-pill trend-pill--stable">Ação comercial</span>
          <strong>Leitura rápida para decisão de compra e venda</strong>
          <p>
            Veja arroba, grãos e notícias em um só lugar e acione seu atendimento técnico comercial com um toque.
          </p>
        </article>
      </section>

      <section className="summary-grid">
        <article className="summary-card">
          <span className="summary-card__label">Maior arroba no painel</span>
          <strong>{formatCurrency(summary.bestArroba?.cash, '/@')}</strong>
          <small>{summary.bestArroba?.region || '—'}</small>
        </article>

        <article className="summary-card">
          <span className="summary-card__label">1º vencimento futuro</span>
          <strong>{formatCurrency(summary.firstFuture?.price, '/@')}</strong>
          <small>{summary.firstFuture?.contract || '—'}</small>
        </article>

        <article className="summary-card">
          <span className="summary-card__label">Milho na praça</span>
          <strong>{formatCurrency(summary.milho?.price, summary.milho?.unit || '')}</strong>
          <small>{summary.milho?.region || '—'}</small>
        </article>

        <article className="summary-card">
          <span className="summary-card__label">Soja na praça</span>
          <strong>{formatCurrency(summary.soja?.price, summary.soja?.unit || '')}</strong>
          <small>{summary.soja?.region || '—'}</small>
        </article>
      </section>

      <section className="panel panel--full">
        <div className="panel__header">
          <div>
            <h2>Evolução local do painel</h2>
            <p>Os gráficos são montados no próprio aplicativo a partir das leituras feitas a cada acesso e atualização.</p>
          </div>
        </div>

        <div className="chart-grid">
          <MiniChart data={history} dataKey="arroba" title="Arroba" suffix="/@" />
          <MiniChart data={history} dataKey="futuro" title="Futuro" suffix="/@" />
          <MiniChart data={history} dataKey="milho" title="Milho" suffix="/sc" />
          <MiniChart data={history} dataKey="soja" title="Soja" suffix="/sc" />
        </div>
      </section>

      <main className="content-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Preço da arroba</h2>
              <p>Mercado físico em praças pecuárias de referência com filtro por estado.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Região</th>
                  <th>À vista</th>
                  <th>30 dias</th>
                </tr>
              </thead>
              <tbody>
                {filteredArroba.map((item) => (
                  <tr key={item.region}>
                    <td>{item.region}</td>
                    <td>{formatCurrency(item.cash, '/@')}</td>
                    <td>{formatCurrency(item.term, '/@')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Mercado futuro</h2>
              <p>Contratos do boi gordo para leitura de tendência e hedge.</p>
            </div>
          </div>

          <div className="chips">
            {data.future?.map((item) => (
              <div key={item.contract} className="chip-card">
                <span>{item.contract}</span>
                <strong>{formatCurrency(item.price, '/@')}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Grãos</h2>
              <p>Milho e soja por praça selecionada.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Praça</th>
                  <th>Preço</th>
                </tr>
              </thead>
              <tbody>
                {data.grains?.map((item, index) => (
                  <tr key={`${item.product}-${index}`}>
                    <td>{item.product}</td>
                    <td>{item.region}</td>
                    <td>{formatCurrency(item.price, item.unit || '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Radar de notícias</h2>
              <p>Últimos destaques da pecuária de corte.</p>
            </div>
          </div>

          <div className="news-list">
            {data.news?.map((item, index) => (
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
          Instale o Boi Agora no celular pelo navegador usando a opção de adicionar à tela inicial. O projeto já foi preparado como app instalável.
        </p>
      </footer>
    </div>
  );
}

export default App;
