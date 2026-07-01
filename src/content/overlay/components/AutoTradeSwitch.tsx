import { MtbToggle } from './MtbToggle';

interface AutoTradeSwitchProps {
  enabled: boolean;
  dryRun: boolean;
  onToggle: (enabled: boolean) => void;
}

export function AutoTradeSwitch({ enabled, dryRun, onToggle }: AutoTradeSwitchProps) {
  const ariaLabel = enabled
    ? dryRun
      ? 'Auto-trade on (dry run)'
      : 'Auto-trade on'
    : 'Auto-trade off';

  return (
    <MtbToggle
      className="mtb-auto-switch"
      label="Auto"
      checked={enabled}
      onChange={onToggle}
      ariaLabel={ariaLabel}
    />
  );
}
