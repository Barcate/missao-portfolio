export default function Loader({ visible }: { visible: boolean }) {
  return (
    <div className={`screen loader${visible ? ' is-visible' : ''}`} role="status" aria-live="polite">
      <div className="loader-content">
        <div className="spinner" />
        <p>Carregando Recursos...</p>
      </div>
    </div>
  );
}
