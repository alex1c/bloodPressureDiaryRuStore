// Jest setup — keep global side effects minimal for Node domain tests.
globalThis.__DEV__ = true
require('./analytics-ads-mocks')
