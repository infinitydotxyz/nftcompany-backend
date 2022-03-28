import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { ErrorResponseDto } from 'common/dto/error-response.dto';
import { Request, Response } from 'express';

/**
 * Custom exception filter to return a more detailed error response.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const response = exception.getResponse();

    let message: string | string[] = exception.message;

    /**
     * Get the message from a class-validator exception
     */
    if (typeof response === 'object' && 'message' in response) {
      message = (response as { message: string | string[] }).message;
    }

    if (Array.isArray(message)) {
      message = message.join(',\n');
    }

    const errorResponse: ErrorResponseDto = {
      success: false,
      statusCode: status,
      message: message,
      timestamp: new Date().getTime(),
      path: req.url
    };

    // Return detailed error response
    res.status(status).json(errorResponse);
  }
}
