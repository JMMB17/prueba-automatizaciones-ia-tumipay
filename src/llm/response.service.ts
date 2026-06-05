import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as yaml from 'js-yaml';
import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ClasificacionResult } from './classifier.service.js';
import { SolicitudInput } from '../ingesta/csv.reader.js';
import { LogService } from '../logs/log.service.js';

const CATEGORIA_A_CLAVE: Record<string, string> = {
  'Soporte técnico': 'soporte_tecnico',
  'Solicitud comercial': 'solicitud_comercial',
  'Riesgo / fraude': 'riesgo_fraude',
  'Conciliación / pagos': 'conciliacion_pagos',
  'Actualización de datos': 'actualizacion_datos',
  'Otro / requiere revisión manual': 'revision_manual',
};

function leerNumeroEnv(nombre: string, valorPorDefecto: number): number {
  const valor = process.env[nombre];

  if (!valor) {
    return valorPorDefecto;
  }

  const numero = Number(valor);

  return Number.isFinite(numero) ? numero : valorPorDefecto;
}

function cargarPrompts(): Record<string, string> {
  const ruta = resolve(process.cwd(), 'prompts/respuestas.yaml');
  const contenido = readFileSync(ruta, 'utf8');
  return yaml.load(contenido) as Record<string, string>;
}

@Injectable()
export class ResponseService {
  private readonly llm: ChatGroq;
  private readonly prompts: Record<string, string>;
  private readonly model: string;
  private readonly temperature: number;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new Error('GROQ_API_KEY is required');
    }

    this.model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
    this.temperature = leerNumeroEnv('GROQ_RESPONSE_TEMPERATURE', 0.3);

    this.llm = new ChatGroq({
      apiKey,
      model: this.model,
      temperature: this.temperature,
    });

    this.prompts = cargarPrompts();
  }

  async generarRespuesta(
    solicitud: SolicitudInput,
    clasificacion: ClasificacionResult,
    logService: LogService,
  ): Promise<string | null> {
    const clave = CATEGORIA_A_CLAVE[clasificacion.categoria];

    if (!clave || !this.prompts[clave]) {
      await logService.warn(
        solicitud.id_solicitud,
        'RESPUESTA',
        `No se encontró prompt para categoría: ${clasificacion.categoria}`,
      );
      return null;
    }

    try {
      await logService.info(
        solicitud.id_solicitud,
        'RESPUESTA',
        `Generando respuesta especializada para categoría: ${clasificacion.categoria}`,
      );

      const promptTemplate = ChatPromptTemplate.fromTemplate(this.prompts[clave]);
      const chain = promptTemplate.pipe(this.llm).pipe(new StringOutputParser());

      const respuesta = await chain.invoke({
        nombre_cliente: solicitud.nombre_cliente || 'Cliente',
        canal: solicitud.canal || '',
        resumen: clasificacion.resumen,
        datos_extraidos: JSON.stringify(clasificacion.datos_extraidos, null, 2),
        prioridad_final: clasificacion.prioridad_final,
      });

      await logService.info(
        solicitud.id_solicitud,
        'RESPUESTA',
        'Respuesta especializada generada correctamente',
      );

      return respuesta.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido en ResponseService';
      await logService.error(solicitud.id_solicitud, 'RESPUESTA', mensaje);
      return null;
    }
  }
}
