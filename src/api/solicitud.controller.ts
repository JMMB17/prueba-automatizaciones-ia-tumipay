import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ProcesarSolicitudDto } from './solicitud.dto.js';
import { ProcessorService } from '../processor/processor.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SalidaSolicitud } from '../output/output.service.js';
import { SolicitudInput } from '../ingesta/csv.reader.js';

type SolicitudRow = {
  idSolicitud: string;
  fecha: string | null;
  canal: string | null;
  tipoCliente: string | null;
  nombreCliente: string | null;
  mensaje: string;
  prioridadReportada: string | null;
  categoria: string | null;
  prioridadFinal: string | null;
  resumen: string | null;
  datosExtraidos: unknown;
  respuestaSugerida: string | null;
  estadoProcesamiento: string;
  razonFallo: string | null;
  fechaProcesamiento: Date;
};

@Controller('api/solicitudes')
export class SolicitudController {
  constructor(
    private readonly processorService: ProcessorService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @HttpCode(201)
  async procesar(@Body() dto: ProcesarSolicitudDto): Promise<SalidaSolicitud> {
    const solicitud: SolicitudInput = {
      id_solicitud: dto.id_solicitud,
      fecha: dto.fecha ?? new Date().toISOString().split('T')[0],
      canal: dto.canal ?? '',
      tipo_cliente: dto.tipo_cliente ?? '',
      nombre_cliente: dto.nombre_cliente ?? '',
      mensaje: dto.mensaje,
      prioridad_reportada: dto.prioridad_reportada ?? '',
    };

    return this.processorService.procesarSolicitudUnica(solicitud);
  }

  @Get()
  async listar(@Query('estado') estado?: string) {
    const solicitudes = await this.prisma.solicitud.findMany({
      where: estado ? { estadoProcesamiento: estado } : undefined,
      orderBy: { fechaProcesamiento: 'desc' },
    });

    return solicitudes.map((s) => this.mapear(s));
  }

  @Get(':id')
  async obtener(@Param('id') id: string) {
    const solicitud = await this.prisma.solicitud.findUnique({
      where: { idSolicitud: id },
    });

    if (!solicitud) {
      throw new NotFoundException(`No se encontró la solicitud con id: ${id}`);
    }

    return this.mapear(solicitud);
  }

  private mapear(s: SolicitudRow) {
    return {
      id_solicitud: s.idSolicitud,
      fecha: s.fecha,
      canal: s.canal,
      tipo_cliente: s.tipoCliente,
      nombre_cliente: s.nombreCliente,
      mensaje: s.mensaje,
      prioridad_reportada: s.prioridadReportada,
      categoria: s.categoria,
      prioridad_final: s.prioridadFinal,
      resumen: s.resumen,
      datos_extraidos: s.datosExtraidos,
      respuesta_sugerida: s.respuestaSugerida,
      estado_procesamiento: s.estadoProcesamiento,
      razon_fallo: s.razonFallo,
      fecha_procesamiento: s.fechaProcesamiento,
    };
  }
}
