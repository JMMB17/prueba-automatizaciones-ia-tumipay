import { describe, expect, it } from '@jest/globals';
import { obtenerRutaCsv } from './cli.js';

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
