import * as Tabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import type { AiAnalystOverlayState, TradingMode } from '../../../types';

export type OverlayTab = 'signal' | 'ai';

interface OverlayTabsProps {
  activeTab: OverlayTab;
  onTabChange: (tab: OverlayTab) => void;
  tradingMode: TradingMode;
  aiAnalystEnabled: boolean;
  aiAnalystState: AiAnalystOverlayState;
  footer?: ReactNode;
  children: ReactNode;
}

export function OverlayTabs({
  activeTab,
  onTabChange,
  tradingMode,
  aiAnalystEnabled,
  aiAnalystState,
  footer,
  children,
}: OverlayTabsProps) {
  const signalLabel = tradingMode === 'AI' ? 'Decision' : 'Signal';

  return (
    <Tabs.Root
      className="mtb-radix-tabs"
      value={activeTab}
      onValueChange={(value) => onTabChange(value as OverlayTab)}
    >
      <div className="mtb-overlay-body">
        <Tabs.List className="mtb-radix-tabs-list" aria-label="Overlay sections">
          <Tabs.Trigger
            className="mtb-radix-tabs-trigger"
            value="signal"
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {signalLabel}
          </Tabs.Trigger>
          <Tabs.Trigger
            className="mtb-radix-tabs-trigger"
            value="ai"
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
          >
            AI Analyst
            {aiAnalystEnabled && aiAnalystState.activity === 'analyzing' && (
              <span className="mtb-tab-badge" aria-hidden="true" />
            )}
          </Tabs.Trigger>
        </Tabs.List>
        <div className="mtb-overlay-main">
          <div className="mtb-overlay-scroll">{children}</div>
          {footer ? <div className="mtb-overlay-footer">{footer}</div> : null}
        </div>
      </div>
    </Tabs.Root>
  );
}
export function OverlayTabPanel({
  value,
  children,
}: {
  value: OverlayTab;
  children: ReactNode;
}) {
  return (
    <Tabs.Content className="mtb-radix-tabs-content" value={value}>
      {children}
    </Tabs.Content>
  );
}
