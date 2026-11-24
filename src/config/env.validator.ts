import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsNumber()
  PORT: number;

  @IsString()
  @Matches(/^\S+$/)
  REDIS_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT: number;

  @IsString()
  @Matches(/^[A-Za-z0-9._:-]{1,64}$/)
  SOCKET_IO_REDIS_KEY = 'socket.io';

  @IsString()
  @Matches(/^mongodb(\+srv)?:\/\//)
  MONGO_URI: string;

  @IsNotEmpty()
  @IsString()
  JWT_SECRET: string;

  @IsString()
  @MinLength(16)
  NOTIFY_API_KEY: string;

  @IsInt()
  @Min(1)
  MESSAGE_RATE_LIMIT: number = 20;

  @IsInt()
  @Min(1)
  MESSAGE_RATE_WINDOW_SECONDS: number = 10;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validated;
}
