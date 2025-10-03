import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DLQManagementService } from './dlq-management.service';

/**
 * DLQ 관리 REST API
 */
@Controller('dlq')
export class DLQController {
  constructor(private readonly dlqManagementService: DLQManagementService) {}

  /**
   * DLQ 상태 조회
   * GET /dlq/status
   */
  @Get('status')
  async getStatus() {
    return this.dlqManagementService.getDLQStatus();
  }

  /**
   * DLQ 메시지 목록 조회
   * GET /dlq/messages?limit=10
   */
  @Get('messages')
  async getMessages(@Query('limit', ParseIntPipe) limit: number = 10) {
    return this.dlqManagementService.getDLQMessages(limit);
  }

  /**
   * orderId로 특정 DLQ 메시지 상세 조회
   * GET /dlq/messages/:orderId
   */
  @Get('messages/:orderId')
  async getMessage(@Param('orderId') orderId: string) {
    return this.dlqManagementService.getDLQMessageByOrderId(orderId);
  }

  /**
   * orderId로 특정 DLQ 메시지 재처리
   * POST /dlq/messages/:orderId/reprocess
   */
  @Post('messages/:orderId/reprocess')
  @HttpCode(HttpStatus.OK)
  async reprocessMessage(@Param('orderId') orderId: string) {
    return this.dlqManagementService.reprocessDLQMessage(orderId);
  }

  /**
   * orderId로 특정 DLQ 메시지 삭제
   * DELETE /dlq/messages/:orderId
   */
  @Delete('messages/:orderId')
  @HttpCode(HttpStatus.OK)
  async deleteMessage(@Param('orderId') orderId: string) {
    return this.dlqManagementService.deleteDLQMessage(orderId);
  }

  /**
   * 모든 DLQ 메시지 일괄 재처리
   * POST /dlq/reprocess-all
   */
  @Post('reprocess-all')
  @HttpCode(HttpStatus.OK)
  async reprocessAll() {
    return this.dlqManagementService.reprocessAllDLQMessages();
  }

  /**
   * 모든 DLQ 메시지 삭제 (purge)
   * DELETE /dlq/purge
   */
  @Delete('purge')
  @HttpCode(HttpStatus.OK)
  async purgeAll() {
    return this.dlqManagementService.purgeAllDLQMessages();
  }
}
