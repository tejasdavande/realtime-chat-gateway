import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsMongoId } from 'class-validator';

export class MarkReadDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsMongoId({ each: true })
  ids: string[];
}
