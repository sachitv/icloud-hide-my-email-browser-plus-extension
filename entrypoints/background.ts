import { defineBackground } from '#imports'
import '../src/pages/Background'

export default defineBackground({
  type: 'module',
  main() {
    // All background logic is executed via the side-effectful import above.
  },
})
