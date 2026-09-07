import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateContractDto {
  @IsUUID()
  customerId: string;

  @IsString()
  @MinLength(2)
  title: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  renewalPeriodMonths?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
