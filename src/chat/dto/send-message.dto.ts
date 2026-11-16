import { IsString, Length, Matches } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,64}$/)
  roomId: string;

  @IsString()
  @Length(1, 2000)
  text: string;
}
