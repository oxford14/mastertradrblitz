import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { AiDecisionOverlay } from '../../../types';

interface AiDecisionPanelProps {
  aiDecision: AiDecisionOverlay | null | undefined;
  error?: string | null;
  loading?: boolean;
}

export function AiDecisionPanel({ aiDecision, error, loading }: AiDecisionPanelProps) {
  const [open, setOpen] = useState(true);

  if (loading && !aiDecision) {
    return (
      <div className="mtb-ai-decision-panel">
        <div className="mtb-radix-collapsible-trigger mtb-ai-decision-panel-stub">
          <span>AI Analysis</span>
        </div>
        <div className="mtb-ai-decision-loading">Waiting for AI decision…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mtb-ai-decision-panel">
        <div className="mtb-radix-collapsible-trigger mtb-ai-decision-panel-stub">
          <span>AI Analysis</span>
        </div>
        <div className="mtb-ai-error">{error}</div>
      </div>
    );
  }

  if (!aiDecision) {
    return (
      <div className="mtb-ai-decision-panel">
        <div className="mtb-radix-collapsible-trigger mtb-ai-decision-panel-stub">
          <span>AI Analysis</span>
        </div>
        <p className="mtb-ai-hint">No AI decision yet — fires on each closed bar.</p>
      </div>
    );
  }

  const hasDetails =
    aiDecision.reasoning.length > 0 ||
    aiDecision.risks.length > 0 ||
    (aiDecision.supportingIndicators?.length ?? 0) > 0;

  return (
    <Collapsible.Root
      className="mtb-ai-decision-panel"
      open={open}
      onOpenChange={setOpen}
    >
      <Collapsible.Trigger className="mtb-radix-collapsible-trigger">
        <span>AI Analysis</span>
        <ChevronDown
          className={`mtb-radix-collapsible-chevron${open ? ' mtb-radix-collapsible-chevron-open' : ''}`}
          size={14}
          aria-hidden
        />
      </Collapsible.Trigger>
      <Collapsible.Content className="mtb-radix-collapsible-content">
        {!hasDetails ? (
          <p className="mtb-ai-hint">No reasoning returned for this decision.</p>
        ) : (
          <>
            {aiDecision.reasoning.length > 0 && (
              <div className="mtb-ai-reasoning">
                <div className="mtb-ai-insight-title">Reasoning</div>
                <ul className="mtb-ai-lessons">
                  {aiDecision.reasoning.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {aiDecision.risks.length > 0 && (
              <div className="mtb-ai-risks-block">
                <div className="mtb-ai-insight-title">Risks</div>
                <ul className="mtb-ai-lessons mtb-ai-risks-list">
                  {aiDecision.risks.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {(aiDecision.supportingIndicators?.length ?? 0) > 0 && (
              <div className="mtb-ai-supporting">
                <div className="mtb-ai-insight-title">Supporting indicators</div>
                <div className="mtb-ai-supporting-tags">
                  {aiDecision.supportingIndicators!.map((ind) => (
                    <span key={ind} className="mtb-badge mtb-badge-neutral">
                      {ind}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
