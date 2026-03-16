import React, { useEffect, useMemo, useState } from 'react';

function parseDateLabel(value) {
  if (!value) return 'Agora';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
}

function toWhatsappLink(message) {
  return `https://wa.me/5562998575050?text=${encodeURIComponent(message)}`;
}

const FALLBACK = {
  updatedAt: new Date().toISOString(),
  status: 'Contingência',
  location: 'Jataí (GO)',
  warning: 'Não foi possível buscar as últimas cotações publicadas neste momento.',
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
  noticias: [],
  sources: [],
};

function App() {
  const [city, setCity] = useState('jatai');
  const [refreshTick, setRefreshTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(FALLBACK);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const response = await fetch(`/.netlify/functions/painel?city=${city}`, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Falha ao atualizar.');
        }

        const payload = await response.json();
        if (!cancelled) {
          setData({ ...FALLBACK, ...payload });
        }
      } catch {
        if (!cancelled) {
          setData(FALLBACK);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    const timer = window.setInterval(load, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [city, refreshTick]);

  const newsItems = useMemo(() => data.noticias || [], [data]);

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__brand">
          <img src="/logo-boi-agora.png" alt="Matsuda Link Representações" className="hero__logo" />
          <div>
            <span className="badge">Aplicativo de inteligência de mercado</span>
            <h1>Boi Agora</h1>
            <p>
              Últimas cotações publicadas dos principais indicadores do mercado pecuário e agrícola,
              com leitura direta para arroba física, mercado futuro, milho, soja e notícias.
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
          <strong>Última atualização publicada</strong>
          <span>{parseDateLabel(data.updatedAt)}</span>
        </div>
        <div>
          <strong>Status</strong>
          <span>{loading ? 'Atualizando dados...' : data.status || 'Online'}</span>
        </div>
        <div>
          <strong>Praça monitorada</strong>
          <span>{data.location || 'Jataí (GO)'}</span>
        </div>
      </section>

      {data.warning ? <div className="alert">{data.warning}</div> : null}

      <section className="summary-grid">
        <article className="summary-card">
          <span className="summary-card__label">Arroba física</span>
          <strong>{data.arroba?.value || '—'}</strong>
          <small>{data.arroba?.region || 'Sem praça disponível'}</small>
          <small>Fonte: {data.arroba?.source || '—'}</small>
        </article>

        <article className="summary-card">
          <span className="summary-card__label">Mercado futuro do boi</span>
          <strong>{data.futuro?.value || '—'}</strong>
          <small>{data.futuro?.contract || 'Sem contrato disponível'}</small>
          <small>Fonte: {data.futuro?.source || '—'}</small>
        </article>

        <article className="summary-card">
          <span className="summary-card__label">Milho</span>
          <strong>{data.graos?.milho || '—'}</strong>
          <small>{data.graos?.milhoPraca || 'Sem praça disponível'}</small>
          <small>Fonte: {data.graos?.source || '—'}</small>
        </article>

        <article className="summary-card">
          <span className="summary-card__label">Soja</span>
          <strong>{data.graos?.soja || '—'}</strong>
          <small>{data.graos?.sojaPraca || 'Sem praça disponível'}</small>
          <small>Fonte: {data.graos?.source || '—'}</small>
        </article>
      </section>

      <section className="content-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Painel de cotações</h2>
              <p>Últimos valores publicados dos indicadores consultados.</p>
            </div>
          </div>

          <div className="quote-stack">
            <div className="quote-box">
              <span>Arroba física</span>
              <strong>{data.arroba?.value || '—'}</strong>
              <small>{data.arroba?.region || ''}</small>
              <p>{data.arroba?.note || ''}</p>
            </div>

            <div className="quote-box">
              <span>Mercado futuro do boi</span>
              <strong>{data.futuro?.value || '—'}</strong>
              <small>{data.futuro?.contract ? `${data.futuro.contract} • ${data.futuro.change}` : ''}</small>
              <p>{data.futuro?.note || ''}</p>
            </div>

            <div className="quote-box">
              <span>Milho</span>
              <strong>{data.graos?.milho || '—'}</strong>
              <small>{data.graos?.milhoPraca || ''}</small>
              <p>{data.graos?.milhoNote || ''}</p>
            </div>

            <div className="quote-box">
              <span>Soja</span>
              <strong>{data.graos?.soja || '—'}</strong>
              <small>{data.graos?.sojaPraca || ''}</small>
              <p>{data.graos?.sojaNote || ''}</p>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Radar de notícias</h2>
              <p>Últimos destaques da pecuária e do mercado.</p>
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
      </section>

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
        <p>As praças exibidas usam a última cotação publicada disponível na fonte consultada.</p>
      </footer>
    </div>
  );
}

export default App;
