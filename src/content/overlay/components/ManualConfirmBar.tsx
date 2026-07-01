interface ManualConfirmBarProps {
  pendingSignal: 'HIGHER' | 'LOWER';
  onConfirm: () => void;
  onReject: () => void;
}

export function ManualConfirmBar({
  pendingSignal,
  onConfirm,
  onReject,
}: ManualConfirmBarProps) {
  return (
    <div className="mtb-manual-confirm">
      <div className="mtb-manual-confirm-title">
        Confirm AI {pendingSignal} trade?
      </div>
      <div className="mtb-manual-confirm-actions">
        <button type="button" className="mtb-manual-confirm-yes" onClick={onConfirm}>
          Confirm
        </button>
        <button type="button" className="mtb-manual-confirm-no" onClick={onReject}>
          Reject
        </button>
      </div>
    </div>
  );
}
