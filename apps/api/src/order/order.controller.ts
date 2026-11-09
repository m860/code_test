import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderService } from './order.service';

@Controller('orders')
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Get()
  list() {
    return this.orders.list();
  }

  @Post()
  create(
    @Body() dto: CreateOrderDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.orders.create(dto, requestId);
  }

  /**
   * kind: default | type_error | null_deref | inventory | payment_timeout
   */
  @Post('boom')
  boom(
    @Query('kind') kind?: string,
    @Headers('x-request-id') _requestId?: string,
  ) {
    const allowed = [
      'default',
      'type_error',
      'null_deref',
      'inventory',
      'payment_timeout',
    ] as const;
    const resolved = allowed.includes(kind as (typeof allowed)[number])
      ? (kind as (typeof allowed)[number])
      : 'default';
    return this.orders.boom(resolved);
  }
}
