import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { OutputService, SalidaProcesamiento } from './output.service.js';

describe('OutputService', () => {
  const cwdOriginal = process.cwd();
  let directorioTemporal = '';

  beforeEach(() => {
    directorioTemporal = mkdtempSync(join(tmpdir(), 'tumi-output-'));
    process.chdir(directorioTemporal);
  });

  afterEach(() => {
    process.chdir(cwdOriginal);
    rmSync(directorioTemporal, { recursive: true, force: true });
  });

  it('sobrescribe datos/output.json con la salida estructurada', async () => {
    const outputService = new OutputService();
    const payload: SalidaProcesamiento = {
      resumen: {
        total_procesadas: 1,
        total_revision_manual: 1,
        total_fallidas: 1,
      },
      solicitudes: [
        {
          id_solicitud: 'SOL-001',
          categoria: 'Soporte técnico',
          prioridad_final: 'Alta',
          resumen: 'Prueba de salida',
          datos_extraidos: { canal: 'correo' },
          respuesta_sugerida: 'Revisaremos tu caso.',
          estado_procesamiento: 'procesada',
          fecha_procesamiento: '2026-06-03T12:00:00.000Z',
        },
      ],
    };

    await outputService.guardarSalida(payload);

    const contenido = readFileSync(join(directorioTemporal, 'datos', 'output.json'), 'utf8');
    expect(JSON.parse(contenido)).toEqual(payload);
  });
});
