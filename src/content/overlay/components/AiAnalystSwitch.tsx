import { MtbToggle } from './MtbToggle';

interface AiAnalystSwitchProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function AiAnalystSwitch({ enabled, onToggle }: AiAnalystSwitchProps) {
  return (
    <MtbToggle
      className="mtb-ai-analyst-switch"
      label="Analyst"
      checked={enabled}
      onChange={onToggle}
      ariaLabel={
        enabled
          ? 'AI trade analyst on (uses OpenRouter credits)'
          : 'AI trade analyst off'
      }
    />
  );
}
