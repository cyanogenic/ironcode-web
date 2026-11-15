import { UserStatus } from "@prisma/client";
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateEngineerDto {
  @IsString()
  @Length(3, 64)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username!: string;

  @IsString()
  @MinLength(12)
  password!: string;

  @IsString()
  @Length(1, 80)
  displayName!: string;

  @IsString()
  storeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  displayName?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class ResetStaffPasswordDto {
  @IsString()
  @MinLength(12)
  password!: string;
}

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}
