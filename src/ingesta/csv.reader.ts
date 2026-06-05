import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';

export interface SolicitudInput {
  id_solicitud: string;
  fecha: string;
  canal: string;
  tipo_cliente: string;
  nombre_cliente: string;
  mensaje: string;
  prioridad_reportada: string;
}

export interface ResultadoIngesta {
  validas: SolicitudInput[];
  invalidas: { fila: number; datos: any; razon: string }[];
}

function normalizarTexto(valor: unknown): string {
  return String(valor ?? '').trim();
}

export function leerCSV(rutaArchivo: string): ResultadoIngesta {
  if (!existsSync(rutaArchivo)) {
    throw new Error(`No se encontró el archivo CSV: ${rutaArchivo}`);
  }

  const contenido = readFileSync(rutaArchivo, 'utf8');
  const filas = parse(contenido, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];

  const validas: SolicitudInput[] = [];
  const invalidas: ResultadoIngesta['invalidas'] = [];

  filas.forEach((fila, index) => {
    const normalizada: SolicitudInput = {
      id_solicitud: normalizarTexto(fila.id_solicitud),
      fecha: normalizarTexto(fila.fecha),
      canal: normalizarTexto(fila.canal),
      tipo_cliente: normalizarTexto(fila.tipo_cliente),
      nombre_cliente: normalizarTexto(fila.nombre_cliente),
      mensaje: normalizarTexto(fila.mensaje),
      prioridad_reportada: normalizarTexto(fila.prioridad_reportada),
    };

    if (!normalizada.id_solicitud) {
      invalidas.push({
        fila: index + 2,
        datos: fila,
        razon: 'Campo obligatorio faltante: id_solicitud',
      });
      return;
    }

    if (!normalizada.mensaje) {
      invalidas.push({
        fila: index + 2,
        datos: fila,
        razon: 'Campo obligatorio faltante: mensaje',
      });
      return;
    }

    const prioridad = normalizada.prioridad_reportada.toLowerCase();
    if (prioridad && !['alta', 'media', 'baja'].includes(prioridad)) {
      invalidas.push({
        fila: index + 2,
        datos: fila,
        razon: `Prioridad inválida: ${normalizada.prioridad_reportada}`,
      });
      return;
    }

    validas.push(normalizada);
  });

  return { validas, invalidas };
}
