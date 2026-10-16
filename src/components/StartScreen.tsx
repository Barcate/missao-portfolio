interface Props {
  visible: boolean;
  onStart: () => void;
}

export default function StartScreen({ visible, onStart }: Props) {
  return (
    <div className={`screen start-screen${visible ? ' is-visible' : ''}`}>
      <div className="content">
        <h1>PRONTO PARA A DECOLAGEM?</h1>
        <button type="button" className="btn-enter" onClick={onStart} disabled={!visible}>
          INICIAR MISSÃO
        </button>
      </div>
    </div>
  );
}
