import { TableClient } from '@azure/data-tables';
import { DefaultAzureCredential, ManagedIdentityCredential } from '@azure/identity';
import type { AppConfig } from '../config/env';
import type { CounterRepository } from '../types/counter';

const partitionKey = 'visitor-counter';
const rowKey = 'global';
const maxConcurrencyRetries = 12;

function isStatus(error: unknown, status: number): boolean {
  return typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === status;
}

export class AzureCounterRepository implements CounterRepository {
  private readonly client: TableClient;

  constructor(config: AppConfig) {
    const endpoint = `https://${config.AZURE_STORAGE_ACCOUNT_NAME}.table.core.windows.net`;
    const credential = config.NODE_ENV === 'production'
      ? new ManagedIdentityCredential()
      : new DefaultAzureCredential();
    this.client = new TableClient(endpoint, 'VisitorCounters', credential);
  }

  async getCount(): Promise<number> {
    try {
      const entity = await this.client.getEntity<{ Count?: number }>(partitionKey, rowKey);
      return typeof entity.Count === 'number' && Number.isSafeInteger(entity.Count) && entity.Count >= 0
        ? entity.Count
        : 0;
    } catch (error) {
      if (isStatus(error, 404)) return 0;
      throw error;
    }
  }

  async increment(): Promise<number> {
    for (let attempt = 0; attempt < maxConcurrencyRetries; attempt += 1) {
      try {
        const entity = await this.client.getEntity<{ Count?: number }>(partitionKey, rowKey);
        const count = typeof entity.Count === 'number' && Number.isSafeInteger(entity.Count) && entity.Count >= 0
          ? entity.Count
          : 0;
        const updatedCount = count + 1;
        await this.client.updateEntity(
          { partitionKey, rowKey, Count: updatedCount },
          'Merge',
          { etag: entity.etag }
        );
        return updatedCount;
      } catch (error) {
        if (isStatus(error, 404)) {
          try {
            await this.client.createEntity({ partitionKey, rowKey, Count: 1 });
            return 1;
          } catch (createError) {
            if (isStatus(createError, 409)) continue;
            throw createError;
          }
        }
        if (isStatus(error, 412)) continue;
        throw error;
      }
    }
    throw new Error('Counter update contention exceeded retry limit');
  }
}
