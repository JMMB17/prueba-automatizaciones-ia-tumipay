import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface SalidaSolicitud {
  id_solicitud: string;
  categoria: string | null;
  prioridad_final: string | null;
  resumen: string | null;
  datos_extraidos: Record<string, unknown>;
  respuesta_sugerida: string | null;
  estado_procesamiento: 'procesada' | 'requiere_revision_manual' | 'fallida';
  fecha_procesamiento: string;
}

export interface SalidaProcesamiento {
  resumen: {
    total_procesadas: number;
    total_revision_manual: number;
    total_fallidas: number;
  };
  solicitudes: SalidaSolicitud[];
}

@Injectable()
export class OutputService {
  private readonly rutaSalida = join(process.cwd(), 'datos', 'output.json');

  async guardarSalida(payload: SalidaProcesamiento): Promise<void> {
    await mkdir(dirname(this.rutaSalida), { recursive: true });
    await writeFile(this.rutaSalida, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }
}
