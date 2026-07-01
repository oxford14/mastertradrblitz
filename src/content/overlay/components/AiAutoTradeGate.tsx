interface AiAutoTradeGateProps {
  message: string | null;
}

export function AiAutoTradeGate({ message }: AiAutoTradeGateProps) {
  const isArmed =
    message != null && (message.startsWith('Armed') || message.startsWith('Ready'));
  const isEmpty = message == null || message === '';

  return (
    <div
      className={[
        'mtb-ai-auto-gate',
        isEmpty ? 'mtb-ai-auto-gate-empty' : '',
        isArmed ? 'mtb-ai-auto-gate-armed' : isEmpty ? '' : 'mtb-ai-auto-gate-blocked',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden={isEmpty}
    >
      {isEmpty ? '\u00a0' : message}
    </div>
  );
}
