import { createApp } from './app';
import { loadConfig } from './config/env';
import { AzureCounterRepository } from './repositories/azureCounterRepository';

const config = loadConfig();
const app = createApp(config, new AzureCounterRepository(config));
const server = app.listen(config.PORT, () => {
  console.log(`Visitor counter API listening on port ${config.PORT}`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down`);
  server.close((error) => {
    if (error) {
      console.error('HTTP server shutdown failed');
      process.exitCode = 1;
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
