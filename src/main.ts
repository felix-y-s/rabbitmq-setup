import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 정의되지 않은 필드 제거
      transform: true, // 자동 타입 변환 활성화
      forbidNonWhitelisted: true, // 허용되지 않은 필드 포함 시 오류 발생
    }),
  );

  app.enableCors({
    origin: true, // 모든 도메인에서 요청 허용
    credentials: true, // 인증 정보(쿠키 등) 포함 허용
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
