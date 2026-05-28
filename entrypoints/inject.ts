import { installInstrumentation } from '@/lib/instrumentation';

export default defineUnlistedScript(() => {
  console.info('[Overfetch Debug] Running injected page script', {
    href: window.location.href,
  });
  installInstrumentation();
});
