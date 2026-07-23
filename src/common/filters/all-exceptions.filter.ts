import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { BusinessException } from '../exceptions/business.exception';
import { ErrorCode } from '../exceptions/error-codes';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof BusinessException) {
      const exceptionResponse = exception.getResponse() as { code: number; message: string; data: unknown };
      return response.status(exception.getStatus()).json({
        code: exceptionResponse.code,
        message: exceptionResponse.message,
        data: exceptionResponse.data ?? null,
        requestId: (request as Request & { requestId?: string }).requestId ?? '',
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const messageData =
        typeof exceptionResponse === 'string'
          ? { message: exceptionResponse }
          : (exceptionResponse as { message?: string | string[]; error?: string });

      // Handle class-validator errors
      const respBody = exceptionResponse as { message?: string | string[]; error?: string };
      if (status === HttpStatus.BAD_REQUEST && Array.isArray(respBody.message)) {
        const messages = respBody.message;
        const fieldErrors = this.parseValidationErrors(messages);
        return response.status(status).json({
          code: ErrorCode.VALIDATION_FAILED,
          message: '参数校验失败',
          data: fieldErrors,
          requestId: (request as Request & { requestId?: string }).requestId ?? '',
        });
      }

      return response.status(status).json({
        code: status,
        message: messageData.message ?? exception.message,
        data: null,
        requestId: (request as Request & { requestId?: string }).requestId ?? '',
      });
    }

    // Unknown errors
    this.logger.error(`Unhandled exception: ${(exception as Error)?.message}`, (exception as Error)?.stack);

    const isProduction = process.env.NODE_ENV === 'production';
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: isProduction ? '服务器内部错误' : ((exception as Error)?.message ?? 'Internal Server Error'),
      data: null,
      requestId: (request as Request & { requestId?: string }).requestId ?? '',
    });
  }

  private parseValidationErrors(messages: string[]): Array<{ field: string; message: string }> {
    return messages.map((msg) => {
      const parts = msg.split(' ');
      const field = parts.length > 0 ? parts[0].replace(/\./g, '') : 'unknown';
      return { field, message: msg };
    });
  }
}
