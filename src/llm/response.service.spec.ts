import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { RunnableLambda } from '@langchain/core/runnables';
import { LogService } from '../logs/log.service.js';
import { ResponseService } from './response.service.js';

type ResponseServiceInspectable = {
  model: string;
  temperature: number;
  llm: RunnableLambda<unknown, string>;
  generarRespuesta: ResponseService['generarRespuesta'];
};

describe('ResponseService', () => {
  const envOriginal = { ...process.env };

  const infoMock: jest.MockedFunction<LogService['info']> = jest.fn(async () => undefined);
  const warnMock: jest.MockedFunction<LogService['warn']> = jest.fn(async () => undefined);
  const errorMock: jest.MockedFunction<LogService['error']> = jest.fn(async () => undefined);

  const logServiceMock = {
    info: infoMock,
    warn: warnMock,
    error: errorMock,
  } as unknown as LogService;

  beforeEach(() => {
    process.env = {
      ...envOriginal,
      GROQ_API_KEY: 'test-api-key',
      GROQ_MODEL: 'test-response-model',
      GROQ_RESPONSE_TEMPERATURE: '0.45',
    };

    infoMock.mockClear();
    warnMock.mockClear();
    errorMock.mockClear();
  });

  afterEach(() => {
    process.env = { ...envOriginal };
  });

  it('genera una respuesta elaborada a partir del prompt de la categoría', async () => {
    const service = new ResponseService() as unknown as ResponseServiceInspectable;
    expect(service.model).toBe('test-response-model');
    expect(service.temperature).toBe(0.45);

    service.llm = new RunnableLambda<unknown, string>({
      func: async () =>
        'Hola, Cliente Uno. Revisamos tu caso y te contactaremos pronto por el canal de seguimiento.',
    });

    const respuesta = await service.generarRespuesta(
      {
        id_solicitud: 'SOL-001',
        fecha: '2026-06-03',
        canal: 'correo',
        tipo_cliente: 'cliente',
        nombre_cliente: 'Cliente Uno',
        mensaje: 'Tengo una transferencia retenida',
        prioridad_reportada: 'alta',
      },
      {
        categoria: 'Conciliación / pagos',
        prioridad_final: 'Alta',
        justificacion_prioridad: 'Caso urgente',
        resumen: 'Transferencia retenida',
        datos_extraidos: { referencia: 'ABC123' },
      },
      logServiceMock,
    );

    expect(infoMock).toHaveBeenCalledWith(
      'SOL-001',
      'RESPUESTA',
      'Generando respuesta especializada para categoría: Conciliación / pagos',
    );
    expect(respuesta).toContain('Cliente Uno');
  });

  it('requiere GROQ_API_KEY para inicializarse', () => {
    process.env = {
      ...envOriginal,
      GROQ_MODEL: 'test-response-model',
      GROQ_RESPONSE_TEMPERATURE: '0.45',
    };

    expect(() => new ResponseService()).toThrow('GROQ_API_KEY is required');
  });
});
