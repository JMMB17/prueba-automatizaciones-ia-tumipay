import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { construirConnectionString } from './prisma.service.js';

describe('construirConnectionString', () => {
  const envOriginal = { ...process.env };

  beforeEach(() => {
    process.env = { ...envOriginal };
  });

  afterEach(() => {
    process.env = { ...envOriginal };
  });

  it('prioriza DATABASE_URL sobre las variables DB_*', () => {
    process.env.DATABASE_URL = 'postgresql://custom:custom@db:5432/customdb?schema=private';
    process.env.DB_HOST = 'ignored-host';
    process.env.DB_PORT = '9999';
    process.env.DB_USER = 'ignored-user';
    process.env.DB_PASSWORD = 'ignored-pass';
    process.env.DB_NAME = 'ignored-db';
    process.env.DB_SCHEMA = 'ignored-schema';

    expect(construirConnectionString()).toBe(
      'postgresql://custom:custom@db:5432/customdb?schema=private',
    );
  });

  it('arma la conexión desde DB_* cuando no existe DATABASE_URL', () => {
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_USER = 'postgres';
    process.env.DB_PASSWORD = 'password';
    process.env.DB_NAME = 'tumipay';
    process.env.DB_SCHEMA = 'public';

    expect(construirConnectionString()).toBe(
      'postgresql://postgres:password@localhost:5432/tumipay?schema=public',
    );
  });
});
