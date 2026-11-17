import type { CounterRepository } from '../types/counter';

export class CounterService {
  constructor(private readonly repository: CounterRepository) {}

  getCount(): Promise<number> {
    return this.repository.getCount();
  }

  increment(): Promise<number> {
    return this.repository.increment();
  }
}
