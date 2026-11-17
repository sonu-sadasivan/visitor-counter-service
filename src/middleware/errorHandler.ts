import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const status = typeof error === 'object' && error !== null && 'status' in error && error.status === 429
    ? 429
    : 500;
  if (status === 429) {
    response.status(429).json({ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' } });
    return;
  }
  response.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to process the request.' } });
};
