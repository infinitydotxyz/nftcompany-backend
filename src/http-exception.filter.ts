import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
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
     * get the message from a class-validator exception
     */
    if (typeof response === 'object' && 'message' in response) {
      message = (response as { message: string | string[] }).message;
    }

    // return detailed error response
    res.status(status).json({
      statusCode: status,
      message: message,
      timestamp: new Date().toISOString(),
      path: req.url
    });
  }
}
