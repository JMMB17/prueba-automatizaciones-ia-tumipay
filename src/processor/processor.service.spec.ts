import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { OutputService } from '../output/output.service.js';
import { ProcessorService } from './processor.service.js';

jest.mock('../logs/log.service.js', () => ({
  LogService: class LogService {},
}));

jest.mock('../prisma/prisma.service.js', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../notifications/slack.service.js', () => ({
  SlackService: class SlackService {},
}));

describe('ProcessorService', () => {
  const cwdOriginal = process.cwd();
  let directorioTemporal = '';
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  const prismaMock = {
    solicitud: {
      upsert: jest.fn(),
    },
  };

  const logServiceMock = {
    info: jest.fn(() => Promise.resolve()),
    warn: jest.fn(() => Promise.resolve()),
    error: jest.fn(() => Promise.resolve()),
  };

  const classifierMock = {
    clasificar: jest.fn(async () => ({
      categoria: 'Conciliación / pagos',
      prioridad_final: 'Alta',
      justificacion_prioridad: 'El caso afecta un pago pendiente.',
      resumen: 'El cliente reporta una transferencia retenida.',
      datos_extraidos: {
        tipo_evento: 'transferencia',
        urgencia: true,
      },
    })),
  };

  const responseServiceMock = {
    generarRespuesta: jest.fn(async () => 'Hola, Cliente Uno. Revisaremos tu caso.'),
  };

  beforeEach(() => {
    directorioTemporal = mkdtempSync(join(tmpdir(), 'tumi-processor-'));
    process.chdir(directorioTemporal);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    process.chdir(cwdOriginal);
    rmSync(directorioTemporal, { recursive: true, force: true });
  });

  it('procesa, persiste y exporta la salida estructurada', async () => {
    const archivoCsv = join(directorioTemporal, 'solicitudes.csv');
    writeFileSync(
      archivoCsv,
      [
        'id_solicitud,fecha,canal,tipo_cliente,nombre_cliente,mensaje,prioridad_reportada',
        'SOL-001,2026-06-03,correo,cliente,Cliente Uno,"Tengo una transferencia retenida",media',
        'SOL-002,2026-06-03,web,comercio,Cliente Dos,"",baja',
      ].join('\n'),
      'utf8',
    );

    const slackMock = { notificar: jest.fn(() => Promise.resolve()) };

    const processor = new ProcessorService(
      prismaMock as never,
      classifierMock as never,
      responseServiceMock as never,
      logServiceMock as never,
      new OutputService(),
      slackMock as never,
    );

    await processor.procesarCSV(archivoCsv);

    expect(classifierMock.clasificar).toHaveBeenCalledTimes(1);
    expect(responseServiceMock.generarRespuesta).toHaveBeenCalledTimes(1);
    expect(prismaMock.solicitud.upsert).toHaveBeenCalledTimes(2);
    expect(logServiceMock.error).toHaveBeenCalledWith(
      'SOL-002',
      'INGESTA',
      'Campo obligatorio faltante: mensaje',
    );

    const salida = JSON.parse(
      readFileSync(join(directorioTemporal, 'datos', 'output.json'), 'utf8'),
    );

    expect(salida.resumen).toEqual({
      total_procesadas: 1,
      total_revision_manual: 0,
      total_fallidas: 1,
    });

    expect(salida.solicitudes).toHaveLength(2);
    expect(salida.solicitudes).toEqual(
      expect.arrayContaining([
      expect.objectContaining({
          id_solicitud: 'SOL-001',
          categoria: 'Conciliación / pagos',
          prioridad_final: 'Alta',
          estado_procesamiento: 'procesada',
          respuesta_sugerida: 'Hola, Cliente Uno. Revisaremos tu caso.',
        }),
        expect.objectContaining({
          id_solicitud: 'SOL-002',
          estado_procesamiento: 'fallida',
        }),
      ]),
    );
  });
});
