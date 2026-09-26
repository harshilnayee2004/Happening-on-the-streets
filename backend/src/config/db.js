import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from './env.js';

let database;

export function getDb() {
  if (!database) {
    if (env.databasePath !== ':memory:') {
      fs.mkdirSync(path.dirname(env.databasePath), { recursive: true });
    }
    database = new DatabaseSync(env.databasePath);
    database.exec('PRAGMA foreign_keys = ON');
    if (env.databasePath !== ':memory:') {
      database.exec('PRAGMA journal_mode = WAL');
    }
  }
  return database;
}

export function closeDb() {
  if (database) {
    database.close();
    database = undefined;
  }
}
