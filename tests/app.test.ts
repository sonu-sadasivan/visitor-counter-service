import request from 'supertest';
import { createApp } from '../src/app';
import type { AppConfig } from '../src/config/env';
import type { CounterRepository } from '../src/types/counter';

const config: AppConfig = {
  AZURE_STORAGE_ACCOUNT_NAME: 'teststorage',
  FRONTEND_ORIGIN: 'https://example.test',
  PORT: 3000,
  NODE_ENV: 'test',
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_MAX: 100
};

function createRepository(): jest.Mocked<CounterRepository> {
  return { getCount: jest.fn(), increment: jest.fn() };
}

describe('visitor counter API', () => {
  it('returns the current count without incrementing', async () => {
    const repository = createRepository();
    repository.getCount.mockResolvedValue(125);
    const response = await request(createApp(config, repository)).get('/api/visits');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ count: 125 });
    expect(repository.increment).not.toHaveBeenCalled();
  });

  it('returns zero when the record is missing', async () => {
    const repository = createRepository();
    repository.getCount.mockResolvedValue(0);
    const response = await request(createApp(config, repository)).get('/api/visits');
    expect(response.body).toEqual({ count: 0 });
  });

  it('increments and returns the persisted count', async () => {
    const repository = createRepository();
    repository.increment.mockResolvedValue(126);
    const response = await request(createApp(config, repository)).post('/api/visits');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ count: 126 });
    expect(repository.increment).toHaveBeenCalledTimes(1);
  });

  it('processes concurrent increment requests independently', async () => {
    let count = 0;
    const repository: CounterRepository = {
      getCount: async () => count,
      increment: async () => {
        await Promise.resolve();
        count += 1;
        return count;
      }
    };
    const app = createApp(config, repository);
    const responses = await Promise.all(Array.from({ length: 20 }, () => request(app).post('/api/visits')));
    expect(responses).toHaveLength(20);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(count).toBe(20);
  });

  it('returns a generic error when storage fails', async () => {
    const repository = createRepository();
    repository.getCount.mockRejectedValue(new Error('sensitive storage details'));
    const response = await request(createApp(config, repository)).get('/api/visits');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to process the request.' } });
    expect(JSON.stringify(response.body)).not.toContain('sensitive');
  });

  it('returns a healthy status without exposing configuration', async () => {
    const response = await request(createApp(config, createRepository())).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'healthy' });
  });

  it('allows only the configured frontend origin', async () => {
    const app = createApp(config, createRepository());
    const allowed = await request(app).options('/api/visits').set('Origin', config.FRONTEND_ORIGIN);
    const rejected = await request(app).options('/api/visits').set('Origin', 'https://attacker.test');
    expect(allowed.headers['access-control-allow-origin']).toBe(config.FRONTEND_ORIGIN);
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns the standard rate limit error', async () => {
    const repository = createRepository();
    const limitedConfig = { ...config, RATE_LIMIT_MAX: 1 };
    const app = createApp(limitedConfig, repository);
    await request(app).post('/api/visits');
    const response = await request(app).post('/api/visits');
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
