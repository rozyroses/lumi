export function ElleMark({ className = "" }: { className?: string }) {
  return <img className={`elle-mark ${className}`} src={`${import.meta.env.BASE_URL}elle-icon.svg`} width="44" height="44" alt="" aria-hidden="true" />;
}

export function ElleWordmark() {
  return <><ElleMark /><b>elle</b></>;
}
