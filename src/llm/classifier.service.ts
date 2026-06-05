import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as yaml from 'js-yaml';
import Groq from 'groq-sdk';
import { SolicitudInput } from '../ingesta/csv.reader.js';
import { LogService } from '../logs/log.service.js';

export interface ClasificacionResult {
  categoria: string;
  prioridad_final: string;
  justificacion_prioridad: string;
  resumen: string;
  datos_extraidos: Record<string, any>;
}

const CATEGORIAS_VALIDAS = [
  'Soporte técnico',
  'Solicitud comercial',
  'Riesgo / fraude',
  'Conciliación / pagos',
  'Actualización de datos',
  'Otro / requiere revisión manual',
];

const PRIORIDADES_VALIDAS = ['Alta', 'Media', 'Baja'];

function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const MAPA_CATEGORIAS = new Map(CATEGORIAS_VALIDAS.map((c) => [sinAcentos(c), c]));
const MAPA_PRIORIDADES = new Map(PRIORIDADES_VALIDAS.map((p) => [sinAcentos(p), p]));

function cargarPromptClasificacion(): string {
  const ruta = resolve(process.cwd(), 'prompts/respuestas.yaml');
  const contenido = readFileSync(ruta, 'utf8');
  const prompts = yaml.load(contenido) as Record<string, string>;
  const prompt = prompts.clasificacion?.trim();

  if (!prompt) {
    throw new Error('No se encontró el prompt de clasificación en prompts/respuestas.yaml');
  }

  return prompt;
}

function leerNumeroEnv(nombre: string, valorPorDefecto: number): number {
  const valor = process.env[nombre];

  if (!valor) {
    return valorPorDefecto;
  }

  const numero = Number(valor);

  return Number.isFinite(numero) ? numero : valorPorDefecto;
}

@Injectable()
export class ClassifierService {
  private readonly groq: Groq;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly maxRetries: number;
  private readonly systemPrompt: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new Error('GROQ_API_KEY is required');
    }

    this.model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
    this.temperature = leerNumeroEnv('GROQ_TEMPERATURE', 0);
    this.maxTokens = leerNumeroEnv('GROQ_MAX_TOKENS', 1000);
    this.maxRetries = Math.max(1, leerNumeroEnv('GROQ_MAX_RETRIES', 2));
    this.systemPrompt = cargarPromptClasificacion();
    this.groq = new Groq({ apiKey });
  }

  private construirPromptUsuario(solicitud: SolicitudInput): string {
    return `Canal: ${solicitud.canal}\nTipo de cliente: ${solicitud.tipo_cliente}\nNombre: ${solicitud.nombre_cliente}\nPrioridad reportada: ${solicitud.prioridad_reportada}\nMensaje: ${solicitud.mensaje}`;
  }

  private validarResultado(resultado: ClasificacionResult): string | null {
    const categoriaCanonica = MAPA_CATEGORIAS.get(sinAcentos(resultado.categoria));

    if (!categoriaCanonica) {
      return `Categoría inválida: ${resultado.categoria}`;
    }

    resultado.categoria = categoriaCanonica;

    const prioridadCanonica = MAPA_PRIORIDADES.get(sinAcentos(resultado.prioridad_final));

    if (!prioridadCanonica) {
      return `Prioridad inválida: ${resultado.prioridad_final}`;
    }

    resultado.prioridad_final = prioridadCanonica;

    if (!resultado.resumen?.trim()) {
      return 'Resumen vacío';
    }

    return null;
  }

  private sanitizarRespuesta(raw: string): string {
    return raw.replace(/```json|```/g, '').trim();
  }

  private imprimirResultado(resultado: ClasificacionResult): void {
    console.log(`Categoría: ${resultado.categoria}`);
    console.log(`Prioridad final: ${resultado.prioridad_final}`);
    console.log(`Resumen: ${resultado.resumen}`);
    console.log('→ Generando respuesta especializada con LangChain...');
  }

  async clasificar(
    solicitud: SolicitudInput,
    logService: LogService,
  ): Promise<ClasificacionResult | null> {
    const promptUsuario = this.construirPromptUsuario(solicitud);

    try {
      for (let intento = 1; intento <= this.maxRetries; intento += 1) {
        await logService.info(
          solicitud.id_solicitud,
          'CLASIFICACION',
          `Llamando a Groq - intento ${intento}`,
          {
            prompt_enviado: promptUsuario,
            intento,
          },
        );

        const completion = await this.groq.chat.completions.create({
          model: this.model,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          messages: [
            {
              role: 'system',
              content: this.systemPrompt,
            },
            {
              role: 'user',
              content: promptUsuario,
            },
          ],
        });

        const raw = completion.choices[0]?.message?.content ?? '';

        await logService.info(solicitud.id_solicitud, 'CLASIFICACION', 'Respuesta cruda recibida', {
          respuesta_raw: raw,
          intento,
        });

        const sanitized = this.sanitizarRespuesta(raw);

        let parsed: ClasificacionResult;
        try {
          parsed = JSON.parse(sanitized) as ClasificacionResult;
        } catch {
          await logService.warn(solicitud.id_solicitud, 'CLASIFICACION', 'JSON malformado');

          if (intento < this.maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }

          await logService.error(solicitud.id_solicitud, 'CLASIFICACION', 'Máximo de reintentos alcanzado');
          return null;
        }

        const razonInvalida = this.validarResultado(parsed);

        if (razonInvalida) {
          await logService.warn(solicitud.id_solicitud, 'CLASIFICACION', razonInvalida);

          if (intento < this.maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }

          await logService.error(solicitud.id_solicitud, 'CLASIFICACION', 'Máximo de reintentos alcanzado');
          return null;
        }

        const resultado = {
          ...parsed,
          datos_extraidos:
            parsed.datos_extraidos && typeof parsed.datos_extraidos === 'object'
              ? parsed.datos_extraidos
              : {},
        };

        this.imprimirResultado(resultado);
        return resultado;
      }

      await logService.error(solicitud.id_solicitud, 'CLASIFICACION', 'Máximo de reintentos alcanzado');
      return null;
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido en Groq';
      await logService.error(solicitud.id_solicitud, 'CLASIFICACION', mensaje);
      return null;
    }
  }
}
