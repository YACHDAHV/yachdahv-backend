import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  console.log(`[boot] starting Yachdahv API pid=${process.pid} port=${process.env.PORT ?? 4000} env=${process.env.NODE_ENV ?? "development"}`);
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.use(helmet());
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN?.split(",") ?? ["http://localhost:3000"],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`[boot] HTTP ready on ${await app.getUrl()}`);
}

void bootstrap();
