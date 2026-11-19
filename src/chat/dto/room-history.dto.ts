import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class RoomHistoryDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,64}$/)
  roomId: string;

  @IsOptional()
  @IsMongoId()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}
