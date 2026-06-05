import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

interface LogExtra {
  prompt_enviado?: string;
  respuesta_raw?: string;
  intento?: number;
}

@Injectable()
export class LogService {
  constructor(private readonly prisma: PrismaService) {}

  async info(
    id_solicitud: string,
    etapa: string,
    mensaje: string,
    extra?: LogExtra,
  ): Promise<void> {
    console.log(`[INFO][${etapa}][${id_solicitud}] ${mensaje}`);

    try {
      await this.prisma.logProcesamiento.create({
        data: {
          idSolicitud: id_solicitud,
          nivel: 'INFO',
          etapa,
          mensaje,
          promptEnviado: extra?.prompt_enviado,
          respuestaRaw: extra?.respuesta_raw,
          intento: extra?.intento,
        },
      });
    } catch (error) {
      console.error(`[ERROR][${etapa}][${id_solicitud}] No se pudo guardar el log INFO`, error);
    }
  }

  async warn(id_solicitud: string, etapa: string, mensaje: string): Promise<void> {
    console.warn(`[WARN][${etapa}][${id_solicitud}] ${mensaje}`);

    try {
      await this.prisma.logProcesamiento.create({
        data: {
          idSolicitud: id_solicitud,
          nivel: 'WARN',
          etapa,
          mensaje,
        },
      });
    } catch (error) {
      console.error(`[ERROR][${etapa}][${id_solicitud}] No se pudo guardar el log WARN`, error);
    }
  }

  async error(id_solicitud: string, etapa: string, mensaje: string): Promise<void> {
    console.error(`[ERROR][${etapa}][${id_solicitud}] ${mensaje}`);

    try {
      await this.prisma.logProcesamiento.create({
        data: {
          idSolicitud: id_solicitud,
          nivel: 'ERROR',
          etapa,
          mensaje,
        },
      });
    } catch (error) {
      console.error(`[ERROR][${etapa}][${id_solicitud}] No se pudo guardar el log ERROR`, error);
    }
  }
}
