import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`Servidor iniciado en http://localhost:${port}`);
  console.log(`POST http://localhost:${port}/api/solicitudes   — procesar una solicitud`);
  console.log(`GET  http://localhost:${port}/api/solicitudes   — listar todas las solicitudes`);
  console.log(`GET  http://localhost:${port}/api/solicitudes/:id — consultar por ID`);
}

void bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
