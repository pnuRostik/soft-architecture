import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  firstname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lastname?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locality_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;
}
