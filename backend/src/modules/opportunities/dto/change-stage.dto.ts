import { IsIn } from 'class-validator';
import { OPPORTUNITY_STAGES } from '../stages';

export class ChangeStageDto {
  @IsIn(OPPORTUNITY_STAGES)
  stage: string;
}
