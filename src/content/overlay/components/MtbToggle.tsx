interface MtbToggleProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  className?: string;
}

export function MtbToggle({
  label,
  checked,
  onChange,
  ariaLabel,
  className,
}: MtbToggleProps) {
  return (
    <div
      className={['mtb-toggle', className].filter(Boolean).join(' ')}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {label ? <span className="mtb-toggle-label">{label}</span> : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        className="mtb-toggle-track"
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
      />
    </div>
  );
}
