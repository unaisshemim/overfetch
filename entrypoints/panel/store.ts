import { create } from 'zustand';
import type {
  AnalyzedRequest,
  AnalyticsSummary,
  EndpointTab,
  PanelTab,
  TabAnalyticsState,
} from '@/lib/types';

interface PanelState {
  tabId: number | null;
  connected: boolean;
  autoRefresh: boolean;
  activePanelTab: PanelTab;
  activeEndpointTab: EndpointTab;
  selectedRequestId: string | null;
  state: TabAnalyticsState | null;
  summary: AnalyticsSummary | null;
  setTabId: (tabId: number) => void;
  setConnected: (connected: boolean) => void;
  setAutoRefresh: (value: boolean) => void;
  setActivePanelTab: (tab: PanelTab) => void;
  setActiveEndpointTab: (tab: EndpointTab) => void;
  selectRequest: (id: string | null) => void;
  applyUpdate: (state: TabAnalyticsState, summary: AnalyticsSummary) => void;
}

export const usePanelStore = create<PanelState>((set, get) => ({
  tabId: null,
  connected: false,
  autoRefresh: true,
  activePanelTab: 'overview',
  activeEndpointTab: 'overview',
  selectedRequestId: null,
  state: null,
  summary: null,
  setTabId: (tabId) => set({ tabId }),
  setConnected: (connected) => set({ connected }),
  setAutoRefresh: (autoRefresh) => set({ autoRefresh }),
  setActivePanelTab: (activePanelTab) => set({ activePanelTab }),
  setActiveEndpointTab: (activeEndpointTab) => set({ activeEndpointTab }),
  selectRequest: (selectedRequestId) => set({ selectedRequestId }),
  applyUpdate: (state, summary) => {
    const prev = get();
  const selectedStillExists = state.requests.some(
      (r) => r.id === prev.selectedRequestId,
    );
    set({
      state,
      summary,
      selectedRequestId: selectedStillExists
        ? prev.selectedRequestId
        : state.requests[0]?.id ?? null,
    });
  },
}));

export function getSelectedRequest(
  state: TabAnalyticsState | null,
  selectedId: string | null,
): AnalyzedRequest | null {
  if (!state || !selectedId) return state?.requests[0] ?? null;
  return state.requests.find((r) => r.id === selectedId) ?? state.requests[0] ?? null;
}
