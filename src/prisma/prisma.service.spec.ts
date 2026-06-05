import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { construirConnectionString, PrismaService } from './prisma.service.js';

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../generated/prisma/client.js', () => ({
  PrismaClient: class PrismaClient {
    $connect = jest.fn().mockResolvedValue(undefined);
    $disconnect = jest.fn().mockResolvedValue(undefined);
    constructor(_opts?: unknown) {}
  },
}));

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

  it('usa valores por defecto cuando no hay ninguna variable de entorno definida', () => {
    delete process.env.DATABASE_URL;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;
    delete process.env.DB_SCHEMA;

    expect(construirConnectionString()).toBe(
      'postgresql://postgres:postgres@localhost:5432/tumipay?schema=public',
    );
  });
});

describe('PrismaService', () => {
  it('puede instanciarse correctamente', () => {
    const service = new PrismaService();
    expect(service).toBeDefined();
  });

  it('conecta a la base de datos en onModuleInit', async () => {
    const service = new PrismaService();
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('desconecta de la base de datos en onModuleDestroy', async () => {
    const service = new PrismaService();
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
