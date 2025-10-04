import { defineBackground } from 'wxt/sandbox';

export default defineBackground({
  type: 'module',
  main() {
    void import('../src/pages/Background');
  },
});
