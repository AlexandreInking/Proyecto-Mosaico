import { UI_CONTRACT_VERSION } from '@mosaico/contracts'

export interface AppShellProps {
  platform: 'Web' | 'Desktop'
  execution: string
  online: boolean
}

const modules = [
  { name: 'Assets', active: true },
  { name: 'Pipelines', active: false },
  { name: 'Mapas', active: false },
  { name: 'Mundo', active: false },
  { name: 'Jobs', active: false },
  { name: 'Exportar', active: false },
]

export function AppShell({ platform, execution, online }: AppShellProps) {
  return (
    <div className="app-shell" data-ui-contract={UI_CONTRACT_VERSION}>
      <header className="titlebar">
        <div className="brand-mark" aria-hidden="true">M</div>
        <div>
          <p className="eyebrow">Mosaico</p>
          <h1>Asset Pipeline AI</h1>
        </div>
        <div className="runtime-status" role="status">
          <span className={`status-dot ${online ? 'online' : ''}`} aria-hidden="true" />
          <span>{platform} · {online ? 'Conectado' : 'Sin conexión'}</span>
        </div>
      </header>

      <nav className="module-nav" aria-label="Módulos principales">
        {modules.map((module) => (
          <button
            className={module.active ? 'active' : ''}
            disabled={!module.active}
            key={module.name}
            type="button"
          >
            {module.name}
            {!module.active && <span>Próximamente</span>}
          </button>
        ))}
      </nav>

      <main className="workspace">
        <aside className="sidebar" aria-label="Catálogo de assets">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Workspace</p>
              <h2>Catálogo</h2>
            </div>
            <button type="button" disabled aria-describedby="t1-note">Importar</button>
          </div>
          <label className="search-label" htmlFor="asset-search">Buscar assets</label>
          <input id="asset-search" type="search" placeholder="Nombre, tipo o etiqueta" disabled />
          <div className="empty-compact">
            <span aria-hidden="true">◇</span>
            <p>Sin assets importados</p>
          </div>
        </aside>

        <section className="stage" aria-labelledby="stage-title">
          <div className="stage-toolbar">
            <div>
              <p className="eyebrow">Vista de trabajo</p>
              <h2 id="stage-title">Preparación de assets</h2>
            </div>
            <span className="execution-badge">Ejecución: {execution}</span>
          </div>

          <div className="dropzone" role="status">
            <div className="drop-icon" aria-hidden="true">＋</div>
            <h3>Importación activada en siguiente fase</h3>
            <p id="t1-note">T0 valida shell compartido, capacidades y separación de plataformas.</p>
            <span className="phase-label">Disponible en T1</span>
          </div>
        </section>

        <aside className="inspector" aria-label="Inspector">
          <p className="eyebrow">Inspector</p>
          <h2>Capacidades</h2>
          <dl>
            <div><dt>Plataforma</dt><dd>{platform}</dd></div>
            <div><dt>Procesamiento</dt><dd>{execution}</dd></div>
            <div><dt>UI Contract</dt><dd>T0 v1</dd></div>
          </dl>
          <div className="notice">
            <strong>Originales inmutables</strong>
            <p>Futuras recetas trabajarán sobre copias y registrarán procedencia.</p>
          </div>
        </aside>
      </main>

      <footer className="statusbar">
        <span>Workspace sin guardar</span>
        <span>0 assets · 0 jobs · 0 errores</span>
      </footer>
    </div>
  )
}
