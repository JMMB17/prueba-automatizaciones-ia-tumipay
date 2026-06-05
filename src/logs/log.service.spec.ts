import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { LogService } from './log.service.js';

describe('LogService', () => {
  const prismaMock = {
    logProcesamiento: {
      create: jest.fn(() => Promise.resolve()),
    },
  };

  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    prismaMock.logProcesamiento.create.mockClear();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('guarda logs INFO con metadatos extra', async () => {
    const service = new LogService(prismaMock as never);

    await service.info('SOL-001', 'CLASIFICACION', 'Mensaje de prueba', {
      prompt_enviado: 'prompt',
      respuesta_raw: 'raw',
      intento: 2,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith('[INFO][CLASIFICACION][SOL-001] Mensaje de prueba');
    expect(prismaMock.logProcesamiento.create).toHaveBeenCalledWith({
      data: {
        idSolicitud: 'SOL-001',
        nivel: 'INFO',
        etapa: 'CLASIFICACION',
        mensaje: 'Mensaje de prueba',
        promptEnviado: 'prompt',
        respuestaRaw: 'raw',
        intento: 2,
      },
    });
  });

  it('guarda logs WARN y ERROR sin metadatos extra', async () => {
    const service = new LogService(prismaMock as never);

    await service.warn('SOL-002', 'INGESTA', 'Advertencia de prueba');
    await service.error('SOL-003', 'ALMACENAMIENTO', 'Error de prueba');

    expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN][INGESTA][SOL-002] Advertencia de prueba');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ERROR][ALMACENAMIENTO][SOL-003] Error de prueba',
    );
    expect(prismaMock.logProcesamiento.create).toHaveBeenNthCalledWith(1, {
      data: {
        idSolicitud: 'SOL-002',
        nivel: 'WARN',
        etapa: 'INGESTA',
        mensaje: 'Advertencia de prueba',
      },
    });
    expect(prismaMock.logProcesamiento.create).toHaveBeenNthCalledWith(2, {
      data: {
        idSolicitud: 'SOL-003',
        nivel: 'ERROR',
        etapa: 'ALMACENAMIENTO',
        mensaje: 'Error de prueba',
      },
    });
  });

  it('no rompe el flujo si persiste un log y Prisma falla', async () => {
    prismaMock.logProcesamiento.create.mockRejectedValueOnce(new Error('boom'));
    const service = new LogService(prismaMock as never);

    await expect(service.info('SOL-004', 'INGESTA', 'Prueba')).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ERROR][INGESTA][SOL-004] No se pudo guardar el log INFO',
      expect.any(Error),
    );
  });
});
