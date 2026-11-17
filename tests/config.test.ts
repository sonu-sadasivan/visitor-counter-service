import { loadConfig } from '../src/config/env';

describe('loadConfig', () => {
  it('rejects invalid startup configuration without echoing values', () => {
    expect(() => loadConfig({
      AZURE_STORAGE_ACCOUNT_NAME: 'invalid-name!',
      FRONTEND_ORIGIN: 'not-a-url',
      NODE_ENV: 'production'
    })).toThrow('Invalid application configuration');
  });
});
