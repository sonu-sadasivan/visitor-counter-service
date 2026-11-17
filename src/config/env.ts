import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  AZURE_STORAGE_ACCOUNT_NAME: z.string().regex(/^[a-z0-9]{3,24}$/),
  FRONTEND_ORIGIN: z.string().url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100)
});

export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    throw new Error(`Invalid application configuration: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  }
  return result.data;
}
