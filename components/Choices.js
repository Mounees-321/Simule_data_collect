// Large, tappable, accessible single-choice list (radio semantics).
// Number keys 1-9 are handled by the parent page.
export default function Choices({ options, value, onChange, showNumbers = false }) {
  return (
    <div className="choice-list" role="radiogroup">
      {options.map((opt, i) => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        const selected = value === val;
        return (
          <button key={val} type="button" role="radio" aria-checked={selected}
            className={`choice ${selected ? 'selected' : ''}`} onClick={() => onChange(val)}>
            <span className="dot" />
            <span>{label}</span>
            {showNumbers && i < 9 && <span className="num">{i + 1}</span>}
          </button>
        );
      })}
    </div>
  );
}
