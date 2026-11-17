export interface CounterRepository {
  getCount(): Promise<number>;
  increment(): Promise<number>;
}
