import { Router } from 'express';
import type { CounterService } from '../services/counterService';

export function createVisitsRouter(counter: CounterService): Router {
  const router = Router();
  router.get('/', async (_request, response, next) => {
    try {
      response.status(200).json({ count: await counter.getCount() });
    } catch (error) {
      next(error);
    }
  });
  router.post('/', async (_request, response, next) => {
    try {
      response.status(200).json({ count: await counter.increment() });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
