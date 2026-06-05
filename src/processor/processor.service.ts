import { Injectable } from '@nestjs/common';
import { leerCSV, SolicitudInput } from '../ingesta/csv.reader.js';
import { ClasificacionResult, ClassifierService } from '../llm/classifier.service.js';
import { ResponseService } from '../llm/response.service.js';
import { LogService } from '../logs/log.service.js';
import { OutputService, SalidaProcesamiento, SalidaSolicitud } from '../output/output.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SlackService } from '../notifications/slack.service.js';

@Injectable()
export class ProcessorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classifierService: ClassifierService,
    private readonly responseService: ResponseService,
    private readonly logService: LogService,
    private readonly outputService: OutputService,
    private readonly slackService: SlackService,
  ) {}

  private async guardarSolicitudFallida(
    solicitud: Partial<SolicitudInput> & { id_solicitud: string },
    razonFallo: string,
  ): Promise<void> {
    await this.prisma.solicitud.upsert({
      where: { idSolicitud: solicitud.id_solicitud },
      create: {
        idSolicitud: solicitud.id_solicitud,
        fecha: solicitud.fecha ?? '',
        canal: solicitud.canal ?? '',
        tipoCliente: solicitud.tipo_cliente ?? '',
        nombreCliente: solicitud.nombre_cliente ?? '',
        mensaje: solicitud.mensaje ?? '',
        prioridadReportada: solicitud.prioridad_reportada ?? '',
        estadoProcesamiento: 'fallida',
        razonFallo,
      },
      update: {
        fecha: solicitud.fecha ?? '',
        canal: solicitud.canal ?? '',
        tipoCliente: solicitud.tipo_cliente ?? '',
        nombreCliente: solicitud.nombre_cliente ?? '',
        mensaje: solicitud.mensaje ?? '',
        prioridadReportada: solicitud.prioridad_reportada ?? '',
        estadoProcesamiento: 'fallida',
        razonFallo,
      },
    });
  }

  private async guardarSolicitudProcesada(
    solicitud: SolicitudInput,
    resultado: ClasificacionResult,
    respuestaSugerida: string | null,
  ): Promise<void> {
    await this.prisma.solicitud.upsert({
      where: { idSolicitud: solicitud.id_solicitud },
      create: {
        idSolicitud: solicitud.id_solicitud,
        fecha: solicitud.fecha,
        canal: solicitud.canal,
        tipoCliente: solicitud.tipo_cliente,
        nombreCliente: solicitud.nombre_cliente,
        mensaje: solicitud.mensaje,
        prioridadReportada: solicitud.prioridad_reportada,
        categoria: resultado.categoria,
        prioridadFinal: resultado.prioridad_final,
        resumen: resultado.resumen,
        datosExtraidos: resultado.datos_extraidos,
        respuestaSugerida: respuestaSugerida ?? null,
        estadoProcesamiento: 'procesada',
      },
      update: {
        fecha: solicitud.fecha,
        canal: solicitud.canal,
        tipoCliente: solicitud.tipo_cliente,
        nombreCliente: solicitud.nombre_cliente,
        mensaje: solicitud.mensaje,
        prioridadReportada: solicitud.prioridad_reportada,
        categoria: resultado.categoria,
        prioridadFinal: resultado.prioridad_final,
        resumen: resultado.resumen,
        datosExtraidos: resultado.datos_extraidos,
        respuestaSugerida: respuestaSugerida ?? null,
        estadoProcesamiento: 'procesada',
        razonFallo: null,
      },
    });
  }

  private async guardarSolicitudRevisionManual(solicitud: SolicitudInput): Promise<void> {
    await this.prisma.solicitud.upsert({
      where: { idSolicitud: solicitud.id_solicitud },
      create: {
        idSolicitud: solicitud.id_solicitud,
        fecha: solicitud.fecha,
        canal: solicitud.canal,
        tipoCliente: solicitud.tipo_cliente,
        nombreCliente: solicitud.nombre_cliente,
        mensaje: solicitud.mensaje,
        prioridadReportada: solicitud.prioridad_reportada,
        estadoProcesamiento: 'requiere_revision_manual',
        razonFallo: 'Clasificación fallida tras 2 intentos',
      },
      update: {
        fecha: solicitud.fecha,
        canal: solicitud.canal,
        tipoCliente: solicitud.tipo_cliente,
        nombreCliente: solicitud.nombre_cliente,
        mensaje: solicitud.mensaje,
        prioridadReportada: solicitud.prioridad_reportada,
        estadoProcesamiento: 'requiere_revision_manual',
        razonFallo: 'Clasificación fallida tras 2 intentos',
      },
    });
  }

  async procesarSolicitudUnica(solicitud: SolicitudInput): Promise<SalidaSolicitud> {
    await this.logService.info(solicitud.id_solicitud, 'INGESTA', 'Solicitud válida recibida');
    const fechaProcesamiento = new Date().toISOString();

    const resultado = await this.classifierService.clasificar(solicitud, this.logService);

    if (!resultado) {
      await this.guardarSolicitudRevisionManual(solicitud);
      await this.logService.warn(
        solicitud.id_solicitud,
        'ALMACENAMIENTO',
        'Solicitud guardada para revisión manual',
      );
      return {
        id_solicitud: solicitud.id_solicitud,
        categoria: null,
        prioridad_final: null,
        resumen: null,
        datos_extraidos: {},
        respuesta_sugerida: null,
        estado_procesamiento: 'requiere_revision_manual',
        fecha_procesamiento: fechaProcesamiento,
      };
    }

    const respuestaSugerida = await this.responseService.generarRespuesta(
      solicitud,
      resultado,
      this.logService,
    );

    await this.guardarSolicitudProcesada(solicitud, resultado, respuestaSugerida);
    await this.logService.info(
      solicitud.id_solicitud,
      'ALMACENAMIENTO',
      'Solicitud procesada y guardada',
    );

    if (resultado.prioridad_final === 'Alta') {
      await this.slackService.notificar(solicitud, resultado);
    }

    return {
      id_solicitud: solicitud.id_solicitud,
      categoria: resultado.categoria,
      prioridad_final: resultado.prioridad_final,
      resumen: resultado.resumen,
      datos_extraidos: resultado.datos_extraidos,
      respuesta_sugerida: respuestaSugerida,
      estado_procesamiento: 'procesada',
      fecha_procesamiento: fechaProcesamiento,
    };
  }

  async procesarCSV(rutaArchivo: string): Promise<void> {
    const { validas, invalidas } = leerCSV(rutaArchivo);

    let totalProcesadas = 0;
    let totalRevisionManual = 0;
    let totalFallidas = 0;
    const solicitudesSalida: SalidaSolicitud[] = [];

    for (const fila of invalidas) {
      const idSolicitud = String(fila.datos?.id_solicitud ?? '');
      const fechaProcesamiento = new Date().toISOString();

      await this.guardarSolicitudFallida(
        fila.datos as Partial<SolicitudInput> & { id_solicitud: string },
        fila.razon,
      );
      await this.logService.error(idSolicitud, 'INGESTA', fila.razon);
      totalFallidas += 1;
      solicitudesSalida.push({
        id_solicitud: idSolicitud,
        categoria: null,
        prioridad_final: null,
        resumen: null,
        datos_extraidos: {},
        respuesta_sugerida: null,
        estado_procesamiento: 'fallida',
        fecha_procesamiento: fechaProcesamiento,
      });
    }

    for (const solicitud of validas) {
      const salidaSolicitud = await this.procesarSolicitudUnica(solicitud);
      solicitudesSalida.push(salidaSolicitud);

      if (salidaSolicitud.estado_procesamiento === 'procesada') totalProcesadas += 1;
      else if (salidaSolicitud.estado_procesamiento === 'requiere_revision_manual') totalRevisionManual += 1;

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const salida: SalidaProcesamiento = {
      resumen: {
        total_procesadas: totalProcesadas,
        total_revision_manual: totalRevisionManual,
        total_fallidas: totalFallidas,
      },
      solicitudes: solicitudesSalida,
    };

    await this.outputService.guardarSalida(salida);

    console.log('Resumen del procesamiento:');
    console.log(`Total procesadas: ${totalProcesadas}`);
    console.log(`Total requieren revisión manual: ${totalRevisionManual}`);
    console.log(`Total fallidas: ${totalFallidas}`);
    console.log('Salida escrita en datos/output.json');
  }
}
