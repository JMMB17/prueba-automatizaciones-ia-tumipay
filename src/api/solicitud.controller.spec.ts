import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SolicitudController } from './solicitud.controller.js';
import { ProcesarSolicitudDto } from './solicitud.dto.js';

const processorMock = {
  procesarSolicitudUnica: jest.fn(),
};

const prismaMock = {
  solicitud: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

function crearControlador(): SolicitudController {
  return new SolicitudController(processorMock as never, prismaMock as never);
}

const solicitudEnDb = {
  idSolicitud: 'SOL-001',
  fecha: '2026-06-08',
  canal: 'API',
  tipoCliente: 'comercio',
  nombreCliente: 'Tienda Demo',
  mensaje: 'Transacciones duplicadas en mi cuenta',
  prioridadReportada: 'baja',
  categoria: 'Conciliación / pagos',
  prioridadFinal: 'Alta',
  resumen: 'El comercio reporta cobros duplicados',
  datosExtraidos: { cantidad: 5 },
  respuestaSugerida: 'Estimado Tienda Demo, revisaremos el caso.',
  estadoProcesamiento: 'procesada',
  razonFallo: null,
  fechaProcesamiento: new Date('2026-06-08T14:00:00.000Z'),
};

describe('SolicitudController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/solicitudes', () => {
    it('llama a procesarSolicitudUnica con los campos del DTO y devuelve el resultado', async () => {
      const salidaEsperada = {
        id_solicitud: 'SOL-001',
        categoria: 'Conciliación / pagos',
        prioridad_final: 'Alta',
        resumen: 'Cobros duplicados',
        datos_extraidos: {},
        respuesta_sugerida: 'Revisaremos el caso.',
        estado_procesamiento: 'procesada' as const,
        fecha_procesamiento: '2026-06-08T14:00:00.000Z',
      };

      processorMock.procesarSolicitudUnica.mockResolvedValue(salidaEsperada);

      const dto: ProcesarSolicitudDto = {
        id_solicitud: 'SOL-001',
        fecha: '2026-06-08',
        canal: 'API',
        tipo_cliente: 'comercio',
        nombre_cliente: 'Tienda Demo',
        mensaje: 'Transacciones duplicadas en mi cuenta',
        prioridad_reportada: 'baja',
      };

      const controller = crearControlador();
      const resultado = await controller.procesar(dto);

      expect(processorMock.procesarSolicitudUnica).toHaveBeenCalledWith(
        expect.objectContaining({
          id_solicitud: 'SOL-001',
          canal: 'API',
          mensaje: 'Transacciones duplicadas en mi cuenta',
          prioridad_reportada: 'baja',
        }),
      );
      expect(resultado).toEqual(salidaEsperada);
    });

    it('rellena la fecha con la del día si no viene en el DTO', async () => {
      processorMock.procesarSolicitudUnica.mockResolvedValue({});

      const dto: ProcesarSolicitudDto = {
        id_solicitud: 'SOL-002',
        mensaje: 'Mensaje sin fecha',
      };

      const controller = crearControlador();
      await controller.procesar(dto);

      const solicitudPasada = (processorMock.procesarSolicitudUnica as jest.MockedFunction<typeof processorMock.procesarSolicitudUnica>).mock.calls[0]?.[0] as { fecha: string };
      expect(solicitudPasada.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('usa cadena vacía para campos opcionales no enviados', async () => {
      processorMock.procesarSolicitudUnica.mockResolvedValue({});

      const dto: ProcesarSolicitudDto = {
        id_solicitud: 'SOL-003',
        mensaje: 'Mensaje mínimo',
      };

      const controller = crearControlador();
      await controller.procesar(dto);

      expect(processorMock.procesarSolicitudUnica).toHaveBeenCalledWith(
        expect.objectContaining({
          canal: '',
          tipo_cliente: '',
          nombre_cliente: '',
          prioridad_reportada: '',
        }),
      );
    });
  });

  describe('GET /api/solicitudes', () => {
    it('devuelve todas las solicitudes sin filtro cuando no se pasa estado', async () => {
      prismaMock.solicitud.findMany.mockResolvedValue([solicitudEnDb]);

      const controller = crearControlador();
      const resultado = await controller.listar();

      expect(prismaMock.solicitud.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
      expect(resultado).toHaveLength(1);
      expect(resultado[0]).toMatchObject({
        id_solicitud: 'SOL-001',
        categoria: 'Conciliación / pagos',
        prioridad_final: 'Alta',
        estado_procesamiento: 'procesada',
      });
    });

    it('filtra por estado cuando se pasa el parámetro', async () => {
      prismaMock.solicitud.findMany.mockResolvedValue([solicitudEnDb]);

      const controller = crearControlador();
      await controller.listar('procesada');

      expect(prismaMock.solicitud.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { estadoProcesamiento: 'procesada' } }),
      );
    });

    it('mapea los campos de camelCase a snake_case', async () => {
      prismaMock.solicitud.findMany.mockResolvedValue([solicitudEnDb]);

      const controller = crearControlador();
      const [primera] = await controller.listar();

      expect(primera).toHaveProperty('id_solicitud');
      expect(primera).toHaveProperty('tipo_cliente');
      expect(primera).toHaveProperty('nombre_cliente');
      expect(primera).toHaveProperty('prioridad_final');
      expect(primera).toHaveProperty('datos_extraidos');
      expect(primera).toHaveProperty('respuesta_sugerida');
      expect(primera).toHaveProperty('estado_procesamiento');
      expect(primera).toHaveProperty('fecha_procesamiento');
    });
  });

  describe('GET /api/solicitudes/:id', () => {
    it('devuelve la solicitud cuando existe', async () => {
      prismaMock.solicitud.findUnique.mockResolvedValue(solicitudEnDb);

      const controller = crearControlador();
      const resultado = await controller.obtener('SOL-001');

      expect(prismaMock.solicitud.findUnique).toHaveBeenCalledWith({
        where: { idSolicitud: 'SOL-001' },
      });
      expect(resultado).toMatchObject({
        id_solicitud: 'SOL-001',
        estado_procesamiento: 'procesada',
      });
    });

    it('lanza NotFoundException cuando el id no existe', async () => {
      prismaMock.solicitud.findUnique.mockResolvedValue(null);

      const controller = crearControlador();

      await expect(controller.obtener('SOL-INEXISTENTE')).rejects.toThrow(NotFoundException);
    });
  });
});
