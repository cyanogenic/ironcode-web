import { IsOptional, IsString, Length, MaxLength } from "class-validator";

export class CreateTicketDto {
  @IsString()
  @Length(2, 200)
  subject!: string;

  @IsString()
  @Length(1, 5000)
  body!: string;

  @IsOptional()
  @IsString()
  orderId?: string;
}

export class ReplyTicketDto {
  @IsString()
  @Length(1, 5000)
  body!: string;
}
