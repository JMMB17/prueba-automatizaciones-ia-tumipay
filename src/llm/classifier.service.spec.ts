import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ClassifierService } from './classifier.service.js';

interface GroqCompletionChoice {
  message: {
    content: string;
  };
}

interface GroqCompletionResponse {
  choices: GroqCompletionChoice[];
}

type GroqCompletionRequest = Record<string, unknown>;

const mockCreateCompletion: jest.MockedFunction<
  (args: GroqCompletionRequest) => Promise<GroqCompletionResponse>
> = jest.fn();

function crearServicioConClienteFalso(): ClassifierService {
  const service = new ClassifierService();

  (service as unknown as {
    groq: { chat: { completions: { create: typeof mockCreateCompletion } } };
  }).groq = {
    chat: {
      completions: {
        create: mockCreateCompletion,
      },
    },
  };

  return service;
}

describe('ClassifierService', () => {
  const envOriginal = { ...process.env };
  const logServiceMock = {
    info: jest.fn(() => Promise.resolve()),
    warn: jest.fn(() => Promise.resolve()),
    error: jest.fn(() => Promise.resolve()),
  };

  beforeEach(() => {
    process.env = {
      ...envOriginal,
      GROQ_API_KEY: 'test-api-key',
      GROQ_MODEL: 'test-model',
      GROQ_TEMPERATURE: '0.25',
      GROQ_MAX_TOKENS: '256',
      GROQ_MAX_RETRIES: '2',
    };
    mockCreateCompletion.mockReset();
    logServiceMock.info.mockClear();
    logServiceMock.warn.mockClear();
    logServiceMock.error.mockClear();
  });

  afterEach(() => {
    process.env = { ...envOriginal };
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('envía la configuración del LLM desde variables de entorno y parsea una respuesta JSON válida', async () => {
    mockCreateCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content:
              '```json\n{"categoria":"Soporte técnico","prioridad_final":"Alta","justificacion_prioridad":"Urgente","resumen":"Cliente reporta un fallo","datos_extraidos":{"tipo_evento":"fallo"}}\n```',
          },
        },
      ],
    });

    const service = crearServicioConClienteFalso();
    const resultado = await service.clasificar(
      {
        id_solicitud: 'SOL-001',
        fecha: '2026-06-03',
        canal: 'correo',
        tipo_cliente: 'cliente',
        nombre_cliente: 'Cliente Uno',
        mensaje: 'Necesito ayuda con una transacción',
        prioridad_reportada: 'baja',
      },
      logServiceMock as never,
    );

    expect(mockCreateCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-model',
        temperature: 0.25,
        max_tokens: 256,
      }),
    );
    expect(resultado).toEqual({
      categoria: 'Soporte técnico',
      prioridad_final: 'Alta',
      justificacion_prioridad: 'Urgente',
      resumen: 'Cliente reporta un fallo',
      datos_extraidos: {
        tipo_evento: 'fallo',
      },
    });
  });

  it('acepta categorías y prioridades sin tildes y las corrige a la forma canónica', async () => {
    mockCreateCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              categoria: 'Conciliacion / pagos',
              prioridad_final: 'alta',
              justificacion_prioridad: 'Dinero no recibido',
              resumen: 'Pago no conciliado',
              datos_extraidos: { referencia: 'TMP-4421' },
            }),
          },
        },
      ],
    });

    const service = crearServicioConClienteFalso();
    const resultado = await service.clasificar(
      {
        id_solicitud: 'TC-API-02',
        fecha: '2026-06-08',
        canal: 'formulario',
        tipo_cliente: 'comercio',
        nombre_cliente: 'Farmacia Salud Total',
        mensaje: 'El pago con referencia TMP-4421 no aparece en nuestro extracto.',
        prioridad_reportada: 'baja',
      },
      logServiceMock as never,
    );

    expect(resultado).not.toBeNull();
    expect(resultado?.categoria).toBe('Conciliación / pagos');
    expect(resultado?.prioridad_final).toBe('Alta');
  });

  it('reintenta cuando el JSON es inválido y termina en null', async () => {
    mockCreateCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'respuesta inválida',
          },
        },
      ],
    });

    jest.useFakeTimers();
    const service = crearServicioConClienteFalso();
    const resultadoPromise = service.clasificar(
      {
        id_solicitud: 'SOL-002',
        fecha: '2026-06-03',
        canal: 'web',
        tipo_cliente: 'comercio',
        nombre_cliente: 'Cliente Dos',
        mensaje: 'No veo mi pago',
        prioridad_reportada: 'media',
      },
      logServiceMock as never,
    );
    await jest.runAllTimersAsync();
    const resultado = await resultadoPromise;

    expect(mockCreateCompletion).toHaveBeenCalledTimes(2);
    expect(logServiceMock.warn).toHaveBeenCalledWith(
      'SOL-002',
      'CLASIFICACION',
      'JSON malformado',
    );
    expect(logServiceMock.error).toHaveBeenCalledWith(
      'SOL-002',
      'CLASIFICACION',
      'Máximo de reintentos alcanzado',
    );
    expect(resultado).toBeNull();
    jest.useRealTimers();
  });
});
