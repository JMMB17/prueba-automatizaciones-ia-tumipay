import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { pathToFileURL } from 'node:url';
import { AppModule } from './app.module.js';
import { ProcessorService } from './processor/processor.service.js';

export function obtenerRutaCsv(argv: string[]): string {
  const flag = argv.find((argument) => argument.startsWith('--file='));

  if (flag) {
    return flag.split('=').slice(1).join('=');
  }

  const positional = argv.find((argument) => !argument.startsWith('--'));

  return positional ?? './datos/solicitudes.csv';
}

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const rutaCsv = obtenerRutaCsv(process.argv.slice(2));
    const processorService = app.get(ProcessorService);
    await processorService.procesarCSV(rutaCsv);
  } finally {
    await app.close();
  }
}

const ejecutadoComoScript =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (ejecutadoComoScript) {
  void bootstrap().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
