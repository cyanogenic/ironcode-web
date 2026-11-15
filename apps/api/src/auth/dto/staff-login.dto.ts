import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, Matches, MinLength } from "class-validator";

export class StaffLoginDto {
  @ApiProperty({ example: "admin" })
  @IsString()
  @Length(3, 64)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username!: string;

  @ApiProperty({ format: "password" })
  @IsString()
  @MinLength(10)
  password!: string;
}
