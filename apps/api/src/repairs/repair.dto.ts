import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class QuoteItemInputDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @IsInt()
  @Min(0)
  @Max(10_000_000)
  unitPriceFen!: number;
}

export class SubmitInspectionDto {
  @IsString()
  @Length(5, 3000)
  cause!: string;

  @IsString()
  @Length(5, 3000)
  solution!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  notes?: string;

  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemInputDto)
  items!: QuoteItemInputDto[];
}

export class QuoteDecisionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
