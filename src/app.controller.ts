import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { UserAuth } from 'auth/user-auth.decorator';
import { Request, Response } from 'express';
import { market } from 'routes/u/_user/market';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('u/:user/market') // TODO migrate this route to follow nest standards
  @UserAuth('user')
  market(@Req() req: Request, @Res() res: Response) {
    void market(req, res);
  }
}
