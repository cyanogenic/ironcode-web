import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { ServiceMode } from "@prisma/client";

export class CreateDeviceDto {
  @IsString()
  @Length(1, 80)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsString()
  @Length(1, 120)
  model!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  serialNo?: string;
}

export class CreateAddressDto {
  @IsString()
  @Length(1, 80)
  recipient!: string;

  @IsString()
  @Length(7, 32)
  phone!: string;

  @IsString()
  @Length(1, 80)
  province!: string;

  @IsString()
  @Length(1, 80)
  city!: string;

  @IsString()
  @Length(1, 80)
  district!: string;

  @IsString()
  @Length(2, 300)
  detail!: string;
}

export class CreateOrderDto {
  @IsEnum(ServiceMode)
  serviceMode!: ServiceMode;

  @IsString()
  @Length(5, 2000)
  problemDescription!: string;

  @IsISO8601({ strict: true })
  scheduledStart!: string;

  @IsISO8601({ strict: true })
  scheduledEnd!: string;

  @ValidateNested()
  @Type(() => CreateDeviceDto)
  device!: CreateDeviceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAddressDto)
  address?: CreateAddressDto;

  @IsBoolean()
  acceptedServiceTerms!: boolean;

  @IsBoolean()
  acceptedPrivacyPolicy!: boolean;

  @IsString()
  @Length(1, 40)
  policyVersion!: string;
}
