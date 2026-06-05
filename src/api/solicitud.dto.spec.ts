import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { ProcesarSolicitudDto } from './solicitud.dto.js';

describe('ProcesarSolicitudDto @Transform en prioridad_reportada', () => {
  it('normaliza a minúsculas y elimina espacios en blanco', () => {
    const dto = plainToInstance(ProcesarSolicitudDto, {
      id_solicitud: 'SOL-001',
      mensaje: 'Consulta',
      prioridad_reportada: '  ALTA  ',
    });

    expect(dto.prioridad_reportada).toBe('alta');
  });

  it('devuelve el valor sin modificar cuando no es una cadena', () => {
    const dto = plainToInstance(ProcesarSolicitudDto, {
      id_solicitud: 'SOL-002',
      mensaje: 'Consulta',
      prioridad_reportada: 123,
    });

    expect(dto.prioridad_reportada).toBe(123);
  });
});
