import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function requiredSecret(name) {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(`${name} must be set to a string of at least 32 characters`);
  }
  return value;
}

function databasePath() {
  const configured = process.env.DATABASE_PATH;
  if (!configured || configured === ':memory:') {
    return configured === ':memory:'
      ? ':memory:'
      : path.join(backendRoot, 'data', 'hapstr.sqlite');
  }
  return path.isAbsolute(configured) ? configured : path.resolve(backendRoot, configured);
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databasePath: databasePath(),
  authSecret: requiredSecret('AUTH_SECRET'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://127.0.0.1:5173',
  isProduction: process.env.NODE_ENV === 'production',
});
