import type { PageMessage } from '@/lib/types';
import { PAGE_MESSAGE_SOURCE } from '@/lib/types';
const DEBUG_PREFIX = '[Overfetch Debug]';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  registration: 'manifest',
  async main() {
    let extensionAlive = true;
    console.info(`${DEBUG_PREFIX} Content script started`, {
      href: window.location.href,
      runAt: 'document_start',
    });

    window.addEventListener('message', (event) => {
      if (!extensionAlive) return;
      if (event.source !== window) return;
      const data = event.data as PageMessage | undefined;
      if (!data || data.source !== PAGE_MESSAGE_SOURCE) return;
      console.info(`${DEBUG_PREFIX} Forwarding page message`, {
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

    try {
      await injectScript('/inject.js', { keepInDom: true });
      console.info(`${DEBUG_PREFIX} Injected main-world script`, {
        href: window.location.href,
      });
    } catch {
      // Same invalidated-context case during extension reload.
      console.info(`${DEBUG_PREFIX} Failed to inject main-world script`);
    }
  },
});
