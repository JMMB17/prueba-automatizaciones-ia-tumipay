import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SlackService } from './slack.service.js';

const mockFetch = jest.fn<typeof fetch>();

describe('SlackService', () => {
  const envOriginal = { ...process.env };

  const solicitud = {
    id_solicitud: 'SOL-003',
    fecha: '2026-06-08',
    canal: 'API',
    tipo_cliente: 'comercio',
    nombre_cliente: 'Restaurante El Patio',
    mensaje: 'Transacciones no reconocidas con valores altos',
    prioridad_reportada: 'baja',
  };

  const resultado = {
    categoria: 'Riesgo / fraude',
    prioridad_final: 'Alta',
    justificacion_prioridad: 'Fraude detectado',
    resumen: 'Restaurante El Patio detectó transacciones no reconocidas',
    datos_extraidos: {},
  };

  beforeEach(() => {
    globalThis.fetch = mockFetch as typeof fetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = { ...envOriginal };
  });

  it('no llama a fetch si SLACK_WEBHOOK_URL no está configurado', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    const service = new SlackService();

    await service.notificar(solicitud, resultado);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('llama a fetch con la URL y el body correcto cuando SLACK_WEBHOOK_URL está configurado', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/TEST';
    mockFetch.mockResolvedValue({ ok: true } as Response);

    const service = new SlackService();
    await service.notificar(solicitud, resultado);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/TEST',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const body = JSON.parse(
      (mockFetch.mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(body.text).toContain('SOL-003');
    expect(body.text).toContain('Riesgo / fraude');
    expect(body.text).toContain('ALTA');
    expect(body.text).toContain('Restaurante El Patio');
  });

  it('no lanza error si fetch falla — degradación silenciosa', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/TEST';
    mockFetch.mockRejectedValue(new Error('Network error'));

    const service = new SlackService();

    await expect(service.notificar(solicitud, resultado)).resolves.not.toThrow();
  });

  it('registra un warning si Slack responde con HTTP de error', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/TEST';
    mockFetch.mockResolvedValue({ ok: false, status: 400 } as Response);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = new SlackService();

    await service.notificar(solicitud, resultado);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('400'));
    warnSpy.mockRestore();
  });
});
