-- Remove the hard foreign key so logs can be recorded before the request is persisted.
ALTER TABLE "logs_procesamiento"
DROP CONSTRAINT IF EXISTS "logs_procesamiento_id_solicitud_fkey";
