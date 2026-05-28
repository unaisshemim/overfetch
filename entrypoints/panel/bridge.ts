import type { BackgroundOutboundMessage } from '@/lib/types';
import { usePanelStore } from './store';

let port: Browser.runtime.Port | null = null;

export function connectPanelBridge(): () => void {
  const tabId = browser.devtools.inspectedWindow.tabId;

  usePanelStore.getState().setTabId(tabId);

  port = browser.runtime.connect({ name: `panel-${tabId}` });

  port.onMessage.addListener((message: BackgroundOutboundMessage) => {
    if (message.tabId !== tabId) return;
    if (!usePanelStore.getState().autoRefresh && message.type === 'state-update') {
      return;
    }
    usePanelStore.getState().applyUpdate(message.state, message.summary);
  });

  port.onDisconnect.addListener(() => {
    usePanelStore.getState().setConnected(false);
  });

  usePanelStore.getState().setConnected(true);

  port.postMessage({ type: 'get-snapshot', tabId });

  return () => {
    port?.disconnect();
    port = null;
  };
}
