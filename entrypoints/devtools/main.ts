import logoUrl from '@/assets/logo.png';

browser.devtools.panels.create(
  'Overfetch',
  logoUrl,
  browser.runtime.getURL('/panel.html'),
  () => undefined,
);
