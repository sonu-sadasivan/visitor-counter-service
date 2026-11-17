jest.mock('@azure/data-tables', () => ({
  TableClient: jest.fn().mockImplementation(() => ({
    getEntity: jest.fn(),
    updateEntity: jest.fn(),
    createEntity: jest.fn()
  }))
}));
jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: class {},
  ManagedIdentityCredential: class {}
}));

import { TableClient } from '@azure/data-tables';
import { AzureCounterRepository } from '../src/repositories/azureCounterRepository';

const config = {
  AZURE_STORAGE_ACCOUNT_NAME: 'teststorage',
  FRONTEND_ORIGIN: 'https://example.test',
  PORT: 3000,
  NODE_ENV: 'test' as const,
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_MAX: 100
};

describe('AzureCounterRepository', () => {
  afterEach(() => jest.restoreAllMocks());

  it('retries an ETag conflict and commits one increment', async () => {
    const repository = new AzureCounterRepository(config);
    const client = (TableClient as unknown as jest.Mock).mock.results.at(-1)?.value as {
      getEntity: jest.Mock;
      updateEntity: jest.Mock;
      createEntity: jest.Mock;
    };
    client.getEntity
      .mockResolvedValueOnce({ partitionKey: 'visitor-counter', rowKey: 'global', Count: 8, etag: 'etag-1' })
      .mockResolvedValueOnce({ partitionKey: 'visitor-counter', rowKey: 'global', Count: 9, etag: 'etag-2' });
    const conflict = Object.assign(new Error('precondition failed'), { statusCode: 412 });
    client.updateEntity.mockRejectedValueOnce(conflict).mockResolvedValueOnce({ etag: 'etag-3' });

    await expect(repository.increment()).resolves.toBe(10);
    expect(client.getEntity).toHaveBeenCalledTimes(2);
    expect(client.updateEntity).toHaveBeenNthCalledWith(1,
      { partitionKey: 'visitor-counter', rowKey: 'global', Count: 9 },
      'Merge',
      { etag: 'etag-1' }
    );
  });

  it('creates the counter row on the first increment', async () => {
    const missing = Object.assign(new Error('not found'), { statusCode: 404 });
    const repository = new AzureCounterRepository(config);
    const client = (TableClient as unknown as jest.Mock).mock.results.at(-1)?.value as {
      getEntity: jest.Mock;
      updateEntity: jest.Mock;
      createEntity: jest.Mock;
    };
    client.getEntity.mockRejectedValue(missing);
    client.createEntity.mockResolvedValue({ etag: 'etag-1' });

    await expect(repository.increment()).resolves.toBe(1);
    expect(client.createEntity).toHaveBeenCalledWith({ partitionKey: 'visitor-counter', rowKey: 'global', Count: 1 });
  });

  it('returns zero on a missing row without creating it', async () => {
    const missing = Object.assign(new Error('not found'), { statusCode: 404 });
    const repository = new AzureCounterRepository(config);
    const client = (TableClient as unknown as jest.Mock).mock.results.at(-1)?.value as {
      getEntity: jest.Mock;
      updateEntity: jest.Mock;
      createEntity: jest.Mock;
    };
    client.getEntity.mockRejectedValue(missing);

    await expect(repository.getCount()).resolves.toBe(0);
    expect(client.createEntity).not.toHaveBeenCalled();
  });
});
