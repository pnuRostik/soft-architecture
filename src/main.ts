import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'identity',
      protoPath: join(__dirname, './proto/identity.proto'),
      url: `0.0.0.0:${process.env.GRPC_PORT ?? 50051}`,
    },
  });


  const yamlFilePath = join(__dirname, '../doc/openapi.yaml');
  const yamlFile = fs.readFileSync(yamlFilePath, 'utf8');


  const swaggerDocument = yaml.load(yamlFile) as any;


  SwaggerModule.setup('api/docs', app, swaggerDocument);


  await app.startAllMicroservices();

  await app.listen(process.env.APP_PORT ?? 3000);


  console.log(`HTTP server is running on: http://localhost:${process.env.APP_PORT ?? 3000}`);
  console.log(`Swagger UI is available at: http://localhost:${process.env.APP_PORT ?? 3000}/api/docs`);
  console.log(`gRPC microservice is running on: 0.0.0.0:${process.env.GRPC_PORT ?? 50051}`);
}
bootstrap();
