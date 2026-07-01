import { useState } from 'react';
import {
  OPENROUTER_MODEL_CUSTOM,
  OPENROUTER_MODEL_PRESETS,
  normalizeOpenRouterModel,
  resolveModelSelectValue,
} from '../../../lib/ai/openrouter-models';

interface AiAnalystModelSelectProps {
  model: string;
  disabled?: boolean;
  onModelChange: (model: string) => void;
}

export function AiAnalystModelSelect({
  model,
  disabled = false,
  onModelChange,
}: AiAnalystModelSelectProps) {
  const selectValue = resolveModelSelectValue(model);
  const [showCustom, setShowCustom] = useState(selectValue === OPENROUTER_MODEL_CUSTOM);

  return (
    <div className="mtb-ai-model-select">
      <label className="mtb-ai-model-select-label">
        <span>Model</span>
        <select
          className="mtb-ai-model-select-input"
          value={selectValue}
          disabled={disabled}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            const next = e.target.value;
            if (next === OPENROUTER_MODEL_CUSTOM) {
              setShowCustom(true);
              return;
            }
            setShowCustom(false);
            onModelChange(normalizeOpenRouterModel(next));
          }}
        >
          {OPENROUTER_MODEL_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
          <option value={OPENROUTER_MODEL_CUSTOM}>Custom…</option>
        </select>
      </label>
      {(showCustom || selectValue === OPENROUTER_MODEL_CUSTOM) && (
        <label className="mtb-ai-model-select-label mtb-ai-model-select-custom">
          <span>Custom slug</span>
          <input
            className="mtb-ai-model-select-input"
            type="text"
            value={model}
            disabled={disabled}
            placeholder="provider/model-name"
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => onModelChange(normalizeOpenRouterModel(e.target.value))}
          />
        </label>
      )}
    </div>
  );
}
