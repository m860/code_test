import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sku!: string;

  @IsInt()
  @Min(1)
  qty!: number;
}
