import { RepairOrderStatus } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class StaffOrderQueryDto {
  @IsOptional()
  @IsEnum(RepairOrderStatus)
  status?: RepairOrderStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 30;
}

export class AssignEngineerDto {
  @IsString()
  engineerId!: string;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class TransitionOrderDto {
  @IsEnum(RepairOrderStatus)
  toStatus!: RepairOrderStatus;

  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
