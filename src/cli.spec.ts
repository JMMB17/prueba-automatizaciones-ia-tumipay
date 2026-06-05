import { describe, expect, it, jest } from '@jest/globals';
import { obtenerRutaCsv } from './cli.js';

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    createApplicationContext: jest.fn(),
  },
}));

jest.mock('./app.module.js', () => ({ AppModule: class AppModule {} }));

describe('obtenerRutaCsv', () => {
  it('prioriza el flag --file', () => {
    expect(obtenerRutaCsv(['--file=./datos/entrada.csv', './datos/otro.csv'])).toBe(
      './datos/entrada.csv',
    );
  });

  it('usa el argumento posicional cuando no hay flag', () => {
    expect(obtenerRutaCsv(['./datos/solicitudes.csv'])).toBe('./datos/solicitudes.csv');
  });

  it('usa el archivo por defecto cuando no recibe argumentos', () => {
    expect(obtenerRutaCsv([])).toBe('./datos/solicitudes.csv');
  });
});

describe('bootstrap', () => {
  it('crea el contexto de aplicación, ejecuta procesarCSV y cierra la aplicación', async () => {
    jest.resetModules();

    const procesarCSVMock = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const closeMock = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const getMock = jest.fn().mockReturnValue({ procesarCSV: procesarCSVMock });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nestMock: any = jest.requireMock('@nestjs/core');
    nestMock.NestFactory.createApplicationContext.mockResolvedValueOnce({
      get: getMock,
      close: closeMock,
    });

    const originalArgv = process.argv;
    process.argv = process.argv.slice(0, 2);
    try {
      const { bootstrap } = await import('./cli.js');
      await bootstrap();
    } finally {
      process.argv = originalArgv;
    }

    expect(getMock).toHaveBeenCalled();
    expect(procesarCSVMock).toHaveBeenCalledWith('./datos/solicitudes.csv');
    expect(closeMock).toHaveBeenCalled();
  });
});
