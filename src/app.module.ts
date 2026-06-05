import { Module } from '@nestjs/common';
import { LogService } from './logs/log.service.js';
import { ClassifierService } from './llm/classifier.service.js';
import { ResponseService } from './llm/response.service.js';
import { OutputService } from './output/output.service.js';
import { ProcessorService } from './processor/processor.service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { SolicitudController } from './api/solicitud.controller.js';
import { SlackService } from './notifications/slack.service.js';

@Module({
  controllers: [SolicitudController],
  providers: [
    PrismaService,
    LogService,
    ClassifierService,
    ResponseService,
    OutputService,
    ProcessorService,
    SlackService,
  ],
  exports: [
    PrismaService,
    LogService,
    ClassifierService,
    ResponseService,
    OutputService,
    ProcessorService,
    SlackService,
  ],
})
export class AppModule {}
