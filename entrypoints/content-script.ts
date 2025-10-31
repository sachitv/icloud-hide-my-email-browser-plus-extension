import { defineContentScript } from '#imports';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*', '<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  registration: 'manifest',
  cssInjectionMode: 'manifest',
  async main() {
    await import('../src/pages/Content');
  },
});
