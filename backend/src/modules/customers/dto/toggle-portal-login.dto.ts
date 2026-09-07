import { IsBoolean } from 'class-validator';

export class TogglePortalLoginDto {
  @IsBoolean()
  isActive: boolean;
}
