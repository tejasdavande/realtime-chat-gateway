import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class NotifyDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 128, { each: true })
  userIds: string[];

  @IsString()
  @Matches(/^[a-z0-9._:-]{1,64}$/)
  type: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
