import type { PageMessage } from '@/lib/types';
import { PAGE_MESSAGE_SOURCE } from '@/lib/types';
const DEBUG_PREFIX = '[Overfetch Debug]';

function debugLog(message: string, details?: Record<string, unknown>): void {
  if (localStorage.getItem('overfetch:debug') !== 'true') return;
  if (details) {
    console.info(`${DEBUG_PREFIX} ${message}`, details);
    return;
  }
  console.info(`${DEBUG_PREFIX} ${message}`);
}

export default defineContentScript({
  runAt: 'document_start',
  registration: 'runtime',
  main() {
    let extensionAlive = true;
    debugLog('Content script started', {
      href: window.location.href,
      runAt: 'document_start',
    });

    window.addEventListener('message', (event) => {
      if (!extensionAlive) return;
      if (event.source !== window) return;
      const data = event.data as PageMessage | undefined;
      if (!data || data.source !== PAGE_MESSAGE_SOURCE) return;
      debugLog('Forwarding page message', {
        type: data.type,
      });

      try {
        void browser.runtime
          .sendMessage(data)
          .catch((error: unknown) => {
            // After extension reload/update, old content script contexts are invalid.
            // Stop forwarding to avoid repeated console noise and work.
            if (
              error instanceof Error &&
              /Extension context invalidated/i.test(error.message)
            ) {
              extensionAlive = false;
            }
          });
      } catch (error) {
        if (
          error instanceof Error &&
          /Extension context invalidated/i.test(error.message)
        ) {
          extensionAlive = false;
        }
      }
    });

  },
});
