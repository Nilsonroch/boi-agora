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

function extractNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;

  const normalized = String(value)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildHistoryPoint(payload) {
  return {
    timestamp: payload.updatedAt || new Date().toISOString(),
    arroba: extractNumber(payload.arroba?.value),
    futuro: extractNumber(payload.futuro?.value),
    milho: extractNumber(payload.graos?.milho),
    soja: extractNumber(payload.graos?.soja),
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
  city: 'Jataí (GO)',
  sources: [
    { name: 'Google News', url: 'https://news.google.com/' },
    { name: 'B3', url: 'https://www.b3.com.br/pt_br/produtos-e-servicos/negociacao/commodities/' },
    { name: 'brapi', url: 'https://brapi.dev/' },
  ],
  arroba: { value: 'R$ 295,00', change: '0,00%', source: 'Contingência' },
  futuro: { value: 'R$ 310,00', change: '0,00%', source: 'Contingência' },
  graos: { milho: 'R$ 68,00', soja: 'R$ 128,00', source: 'Contingência' },
  noticias: [
    {
      title: 'Mercado pecuário em monitoramento',
      link: 'https://news.google.com/',
      source: 'Boi Agora',
    },
    {
      title: 'Arroba e grãos aguardando atualização externa',
      link: 'https://news.google.com/',
      source: 'Boi Agora',
    },
  ],
  warning: 'Não foi possível atualizar completamente o painel.',
};

function App() {
  const [data, setData] = useState(MOCK_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [city, setCity] = useState('jatai');
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
          setHistory(saveHistory(city, buildHistoryPoint(merged)));

          if (payload.warning) {
            setError(payload.warning);
          }
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

  const summary = useMemo(() => {
    return {
      arroba: data.arroba,
      futuro: data.futuro,
      milho: data.graos?.milho,
      soja: data.graos?.soja,
    };
  }, [data]);

  const alerts = useMemo(() => {
    const current = history[history.length - 1];
    const previous = history[history.length - 2];
    return {
      arroba: deltaInfo(current?.arroba, previous?.arroba),
      futuro: deltaInfo(current?.futuro, previous?.futuro),
      milho: deltaInfo(current?.milho, previous?.milho),
      soja: deltaInfo(current?.soja, previous?.soja),
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
              Painel vivo da pecuária com referência B3 do boi, mercado futuro, grãos e notícias estratégicas
              sempre que o aplicativo for acessado.
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
          <span>{loading ? 'Atualizando dados...' : error ? 'Atualizado com observações' : 'Online'}</span>
        </div>
        <div>
          <strong>Praça monitorada</strong>
          <span>{data.location || data.city || 'Jataí (GO)'}</span>
        </div>
      </section>

      {error ? <div className="alert">{error}</div> : null}

      <section className="commercial-grid">
        <article className="commercial-card">
          <span className={`trend-pill trend-pill--${alerts.arroba.direction}`}>
            {alerts.arroba.direction === 'up' ? 'Alerta de alta' : alerts.arroba.direction === 'down' ? 'Alerta de baixa' : 'Sem oscilação'}
          </span>
          <strong>{alerts.arroba.label}</strong>
          <p>
            A referência B3 do boi está em {summary.arroba?.value || '—'}. Use esse sinal como apoio para leitura de
            mercado e posicionamento comercial.
          </p>
        </article>

        <article className="commercial-card">
          <span className={`trend-pill trend-pill--${alerts.futuro.direction}`}>Mercado futuro</span>
          <strong>{summary.futuro?.source || 'Sem fonte disponível'}</strong>
          <p>
            O mercado futuro do boi está em {summary.futuro?.value || '—'}. Acompanhe a direção do mercado com atualização do painel.
          </p>
        </article>

        <article className="commercial-card commercial-card--strong">
          <span className="trend-pill trend-pill--stable">Ação comercial</span>
          <strong>Leitura rápida para decisão de compra e venda</strong>
          <p>
            Veja referência B3 do boi, mercado futuro, milho, soja e notícias em um só lugar e acione seu atendimento técnico comercial com um toque.
          </p>
        </article>
      </section>

      <section className="summary-grid">
        <article className="summary-card">
          <span className="summary-card__label">Arroba referência B3</span>
          <strong>{summary.arroba?.value || '—'}</strong>
          <small>Fonte: {summary.arroba?.source || '—'}</small>
        </article>

        <article className="summary-card">
          <span className="summary-card__label">Mercado futuro do boi</span>
          <strong>{summary.futuro?.value || '—'}</strong>
          <small>Fonte: {summary.futuro?.source || '—'}</small>
        </article>

        <article className="summary-card">
          <span className="summary-card__label">Milho</span>
          <strong>{summary.milho || '—'}</strong>
          <small>Fonte: {data.graos?.source || '—'}</small>
        </article>

        <article className="summary-card">
          <span className="summary-card__label">Soja</span>
          <strong>{summary.soja || '—'}</strong>
          <small>Fonte: {data.graos?.source || '—'}</small>
        </article>
      </section>

      <div className="market-note">
        A arroba exibida no painel é uma referência de mercado via B3 e não substitui a cotação física local por praça pecuária.
      </div>

      <section className="panel panel--full">
        <div className="panel__header">
          <div>
            <h2>Evolução local do painel</h2>
            <p>Os gráficos são montados no próprio aplicativo a partir das leituras feitas a cada acesso e atualização.</p>
          </div>
        </div>

        <div className="chart-grid">
          <MiniChart data={history} dataKey="arroba" title="Arroba referência B3" suffix="/@" />
          <MiniChart data={history} dataKey="futuro" title="Mercado futuro do boi" suffix="/@" />
          <MiniChart data={history} dataKey="milho" title="Milho" />
          <MiniChart data={history} dataKey="soja" title="Soja" />
        </div>
      </section>

      <main className="content-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Arroba referência B3</h2>
              <p>Referência financeira usada como apoio de leitura de mercado.</p>
            </div>
          </div>

          <div className="chips">
            <div className="chip-card">
              <span>Valor atual</span>
              <strong>{data.arroba?.value || '—'}</strong>
            </div>
            <div className="chip-card">
              <span>Variação</span>
              <strong>{data.arroba?.change || '—'}</strong>
            </div>
            <div className="chip-card">
              <span>Fonte</span>
              <strong>{data.arroba?.source || '—'}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Mercado futuro do boi</h2>
              <p>Leitura de mercado futuro para acompanhamento e estratégia comercial.</p>
            </div>
          </div>

          <div className="chips">
            <div className="chip-card">
              <span>Valor atual</span>
              <strong>{data.futuro?.value || '—'}</strong>
            </div>
            <div className="chip-card">
              <span>Variação</span>
              <strong>{data.futuro?.change || '—'}</strong>
            </div>
            <div className="chip-card">
              <span>Fonte</span>
              <strong>{data.futuro?.source || '—'}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Grãos</h2>
              <p>Milho e soja monitorados no painel.</p>
            </div>
          </div>

          <div className="chips">
            <div className="chip-card">
              <span>Milho</span>
              <strong>{data.graos?.milho || '—'}</strong>
            </div>
            <div className="chip-card">
              <span>Soja</span>
              <strong>{data.graos?.soja || '—'}</strong>
            </div>
            <div className="chip-card">
              <span>Fonte</span>
              <strong>{data.graos?.source || '—'}</strong>
            </div>
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
            {(data.noticias || data.news || []).map((item, index) => (
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
