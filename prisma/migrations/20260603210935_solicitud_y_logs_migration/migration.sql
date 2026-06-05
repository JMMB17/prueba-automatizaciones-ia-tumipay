-- CreateTable
CREATE TABLE "solicitudes" (
    "id" SERIAL NOT NULL,
    "id_solicitud" VARCHAR(50) NOT NULL,
    "fecha" VARCHAR(50),
    "canal" VARCHAR(100),
    "tipo_cliente" VARCHAR(100),
    "nombre_cliente" VARCHAR(255),
    "mensaje" TEXT NOT NULL,
    "prioridad_reportada" VARCHAR(20),
    "categoria" VARCHAR(100),
    "prioridad_final" VARCHAR(20),
    "resumen" TEXT,
    "datos_extraidos" JSONB,
    "respuesta_sugerida" TEXT,
    "estado_procesamiento" VARCHAR(50) NOT NULL,
    "razon_fallo" TEXT,
    "fecha_procesamiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitudes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_procesamiento" (
    "id" SERIAL NOT NULL,
    "id_solicitud" VARCHAR(50) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nivel" VARCHAR(10) NOT NULL,
    "etapa" VARCHAR(50) NOT NULL,
    "mensaje" TEXT NOT NULL,
    "prompt_enviado" TEXT,
    "respuesta_raw" TEXT,
    "intento" INTEGER,

    CONSTRAINT "logs_procesamiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_id_solicitud_key" ON "solicitudes"("id_solicitud");

-- AddForeignKey
ALTER TABLE "logs_procesamiento" ADD CONSTRAINT "logs_procesamiento_id_solicitud_fkey" FOREIGN KEY ("id_solicitud") REFERENCES "solicitudes"("id_solicitud") ON DELETE CASCADE ON UPDATE CASCADE;
