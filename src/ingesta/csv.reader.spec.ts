import { mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { leerCSV } from './csv.reader.js';

describe('leerCSV', () => {
  const archivosTemporales: string[] = [];

  afterEach(async () => {
    await Promise.all(
      archivosTemporales.splice(0).map(async (archivo) => {
        await rm(archivo, { force: true, recursive: true });
      }),
    );
  });

  it('separa solicitudes válidas e inválidas', () => {
    const directorioTemporal = mkdtempSync(join(tmpdir(), 'tumi-csv-'));
    const archivo = join(directorioTemporal, 'solicitudes.csv');
    archivosTemporales.push(directorioTemporal);

    writeFileSync(
      archivo,
      [
        'id_solicitud,fecha,canal,tipo_cliente,nombre_cliente,mensaje,prioridad_reportada',
        'SOL-001,2026-06-03,correo,comercio,Cliente Uno,"Necesito ayuda con mi transferencia",alta',
        ',"2026-06-03",whatsapp,cliente,Cliente Dos,"",media',
        'SOL-003,2026-06-03,api,aliado,Cliente Tres,"Quiero cambiar mis datos",critica',
      ].join('\n'),
      'utf8',
    );

    const resultado = leerCSV(archivo);

    expect(resultado.validas).toHaveLength(1);
    expect(resultado.validas[0]).toMatchObject({
      id_solicitud: 'SOL-001',
      canal: 'correo',
      prioridad_reportada: 'alta',
    });

    expect(resultado.invalidas).toHaveLength(2);
    expect(resultado.invalidas[0]).toMatchObject({
      fila: 3,
      razon: 'Campo obligatorio faltante: id_solicitud',
    });
    expect(resultado.invalidas[1]).toMatchObject({
      fila: 4,
      razon: 'Prioridad inválida: critica',
    });
  });

  it('marca como inválida una fila con mensaje vacío', () => {
    const directorioTemporal = mkdtempSync(join(tmpdir(), 'tumi-csv-'));
    const archivo = join(directorioTemporal, 'solicitudes.csv');
    archivosTemporales.push(directorioTemporal);

    writeFileSync(
      archivo,
      [
        'id_solicitud,fecha,canal,tipo_cliente,nombre_cliente,mensaje,prioridad_reportada',
        'SOL-010,2026-06-03,correo,cliente,Cliente Uno,"   ",alta',
      ].join('\n'),
      'utf8',
    );

    const resultado = leerCSV(archivo);

    expect(resultado.validas).toHaveLength(0);
    expect(resultado.invalidas).toHaveLength(1);
    expect(resultado.invalidas[0]).toMatchObject({
      fila: 2,
      razon: 'Campo obligatorio faltante: mensaje',
    });
  });

  it('devuelve cero resultados cuando el CSV está vacío', () => {
    const directorioTemporal = mkdtempSync(join(tmpdir(), 'tumi-csv-'));
    const archivo = join(directorioTemporal, 'solicitudes.csv');
    archivosTemporales.push(directorioTemporal);

    writeFileSync(
      archivo,
      'id_solicitud,fecha,canal,tipo_cliente,nombre_cliente,mensaje,prioridad_reportada\n',
      'utf8',
    );

    const resultado = leerCSV(archivo);

    expect(resultado.validas).toHaveLength(0);
    expect(resultado.invalidas).toHaveLength(0);
  });

  it('lanza error si el archivo no existe', () => {
    expect(() => leerCSV('ruta/que/no/existe.csv')).toThrow(
      'No se encontró el archivo CSV: ruta/que/no/existe.csv',
    );
  });
});
