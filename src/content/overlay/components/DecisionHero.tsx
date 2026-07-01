import type { AiDecisionOverlay } from '../../../types';

interface DecisionHeroProps {
  aiDecision: AiDecisionOverlay | null | undefined;
  loading?: boolean;
  confirming?: boolean;
  pendingSignal?: string;
  holdRemaining?: number;
}

function heroClass(decision: AiDecisionOverlay['decision'] | undefined): string {
  if (decision === 'BUY') return 'mtb-decision-hero-buy';
  if (decision === 'SELL') return 'mtb-decision-hero-sell';
  return 'mtb-decision-hero-wait';
}

function resolveSubline(input: {
  loading?: boolean;
  confirming?: boolean;
  pendingSignal?: string;
  holdRemaining?: number;
  aiDecision: AiDecisionOverlay | null | undefined;
  decision: AiDecisionOverlay['decision'];
  confidence: number;
}): { text: string; className: string } {
  const { loading, confirming, pendingSignal, holdRemaining, aiDecision, decision, confidence } =
    input;

  if (loading) {
    return { text: 'Analyzing snapshot…', className: 'mtb-decision-hero-subline-loading' };
  }
  if (confirming && pendingSignal && pendingSignal !== 'WAIT') {
    return {
      text: `Confirming ${pendingSignal} — ${holdRemaining ?? 0}s`,
      className: 'mtb-decision-hero-subline-confirming',
    };
  }
  if (aiDecision && decision !== 'WAIT') {
    return {
      text: `${confidence}% confidence`,
      className: 'mtb-decision-hero-subline-confidence',
    };
  }
  return { text: '\u00a0', className: 'mtb-decision-hero-subline-empty' };
}

export function DecisionHero({
  aiDecision,
  loading,
  confirming,
  pendingSignal,
  holdRemaining,
}: DecisionHeroProps) {
  const decision = aiDecision?.decision ?? 'WAIT';
  const confidence = aiDecision?.confidence ?? 0;
  const label = confirming && pendingSignal && pendingSignal !== 'WAIT' ? 'WAIT' : decision;
  const heroVariant =
    confirming && pendingSignal && pendingSignal !== 'WAIT'
      ? 'mtb-decision-hero-wait'
      : heroClass(decision);
  const subline = resolveSubline({
    loading,
    confirming,
    pendingSignal,
    holdRemaining,
    aiDecision,
    decision,
    confidence,
  });

  return (
    <div className={`mtb-decision-hero ${heroVariant}`}>
      <div className="mtb-decision-hero-label">{label}</div>
      <div className={`mtb-decision-hero-subline ${subline.className}`}>{subline.text}</div>
    </div>
  );
}
