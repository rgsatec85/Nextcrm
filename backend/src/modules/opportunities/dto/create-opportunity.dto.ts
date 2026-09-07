import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { OPPORTUNITY_STAGES } from '../stages';

export class CreateOpportunityDto {
  @IsUUID()
  customerId: string;

  @IsString()
  @MinLength(2)
  title: string;

  @IsOptional()
  @IsIn(OPPORTUNITY_STAGES)
  stage?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
