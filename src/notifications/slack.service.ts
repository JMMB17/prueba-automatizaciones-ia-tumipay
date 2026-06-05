import { Injectable } from '@nestjs/common';
import { ClasificacionResult } from '../llm/classifier.service.js';
import { SolicitudInput } from '../ingesta/csv.reader.js';

@Injectable()
export class SlackService {
  private readonly webhookUrl: string | null;

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL ?? null;
  }

  async notificar(solicitud: SolicitudInput, resultado: ClasificacionResult): Promise<void> {
    if (!this.webhookUrl) return;

    const texto = this.formatearMensaje(solicitud, resultado);

    try {
      const respuesta = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: texto }),
      });

      if (!respuesta.ok) {
        console.warn(`[WARN][SLACK] Notificación fallida — HTTP ${respuesta.status}`);
      } else {
        console.log(`[INFO][SLACK] Alerta enviada: ${solicitud.id_solicitud}`);
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      console.warn(`[WARN][SLACK] No se pudo enviar la notificación: ${mensaje}`);
    }
  }

  private formatearMensaje(solicitud: SolicitudInput, resultado: ClasificacionResult): string {
    const separador = '───────────────────────────────────';
    const fecha = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const lineas = [
      '*TUMIPAY — Alerta de prioridad Alta*',
      separador,
      `*ID:*        ${solicitud.id_solicitud}`,
      `*Categoría:* ${resultado.categoria}`,
      `*Prioridad:* ALTA`,
      `*Cliente:*   ${solicitud.nombre_cliente || 'No especificado'}`,
      `*Canal:*     ${solicitud.canal || 'No especificado'}`,
      '',
      `_${resultado.resumen}_`,
      separador,
      fecha,
    ];

    return lineas.join('\n');
  }
}
