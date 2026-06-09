import { installInstrumentation } from '@/lib/instrumentation';

export default defineContentScript({
  runAt: 'document_start',
  registration: 'runtime',
  world: 'MAIN',
  main() {
    if (localStorage.getItem('overfetch:debug') === 'true') {
      console.info('[Overfetch Debug] Running injected page script', {
        href: window.location.href,
      });
    }
    installInstrumentation();
  },
});
