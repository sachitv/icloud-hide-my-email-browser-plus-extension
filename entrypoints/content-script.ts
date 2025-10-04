import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*', '<all_urls>'],
  registration: 'manifest',
  cssInjectionMode: 'manifest',
  main() {
    void import('../src/pages/Content');
  },
});
