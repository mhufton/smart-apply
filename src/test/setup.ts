/// <reference types="vitest/globals" />

// Minimal Chrome extension API mock
// Add more methods here as tests require them.

const storage: Record<string, unknown> = {}

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[]) => {
        const ks = Array.isArray(keys) ? keys : [keys]
        return Object.fromEntries(ks.map(k => [k, storage[k]]))
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(storage, items)
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const ks = Array.isArray(keys) ? keys : [keys]
        ks.forEach(k => delete storage[k])
      }),
    },
  },
  runtime: {
    id: 'test-extension-id',
    onMessage: { addListener: vi.fn() },
  },
}

// @ts-expect-error — chrome is not defined in jsdom; we inject a mock
globalThis.chrome = chromeMock

// Reset storage and mocks between tests
beforeEach(() => {
  Object.keys(storage).forEach(k => delete storage[k])
  vi.clearAllMocks()
})
