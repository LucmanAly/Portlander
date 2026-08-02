import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// vitest.config.ts doesn't set `test.globals: true`, so RTL's automatic
// afterEach-cleanup (which relies on a global `afterEach`) never registers —
// wire it explicitly instead of adding globals just for this.
afterEach(() => {
  cleanup()
})
