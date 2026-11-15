import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsString, Matches, MaxLength } from "class-validator";

export class RequestCustomerCodeDto {
  @ApiProperty({ example: "13800138000" })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, {
    message: "phone must be a valid mainland China mobile number",
  })
  phone!: string;
}

export class VerifyCustomerCodeDto extends RequestCustomerCodeDto {
  @ApiProperty({ example: "123456" })
  @IsString()
  @Matches(/^\d{6}$/, { message: "code must contain 6 digits" })
  code!: string;
}

export class RequestCustomerEmailCodeDto {
  @ApiProperty({ example: "customer@example.com" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class VerifyCustomerEmailCodeDto extends RequestCustomerEmailCodeDto {
  @ApiProperty({ example: "123456" })
  @IsString()
  @Matches(/^\d{6}$/, { message: "code must contain 6 digits" })
  code!: string;
}
