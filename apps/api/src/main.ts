import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';
import { SentryService } from './sentry/sentry.service';

loadDotenv({ path: resolve(__dirname, '../../../.env') });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const sentry = app.get(SentryService);

  await sentry.initFromConfig();

  app.setGlobalPrefix('v1');
  app.enableCors({ origin: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new SentryExceptionFilter(sentry));

  const port = config.get<number>('port') ?? 3100;
  await app.listen(port);
}

void bootstrap();
