import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { InstagramService } from './instagram.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('auth/instagram')
export class InstagramController {
  constructor(private readonly instagramService: InstagramService) {}

  @UseGuards(JwtAuthGuard)
  @Get('auth-url/:accountId')
  getAuthUrl(@Param('accountId') accountId: string, @GetUser() user: any) {
    return this.instagramService.getAuthUrl(+accountId, user.id);
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard/ig-accounts?error=${encodeURIComponent(error)}`);
    }

    try {
      const result = await this.instagramService.handleCallback(code, state);
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard/ig-accounts?success=true&username=${result.instagram.username}`);
    } catch (error) {
      console.error('Instagram callback error:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard/ig-accounts?error=${encodeURIComponent(error.message)}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('status/:accountId')
  getStatus(@Param('accountId') accountId: string, @GetUser() user: any) {
    return this.instagramService.getStatus(+accountId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('test/:accountId')
  testConnection(@Param('accountId') accountId: string, @GetUser() user: any) {
    return this.instagramService.testConnection(+accountId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('disconnect/:accountId')
  disconnect(@Param('accountId') accountId: string, @GetUser() user: any) {
    return this.instagramService.disconnect(+accountId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('post')
  postContent(
    @Body() data: { contentId: number; accountId: number },
    @GetUser() user: any,
  ) {
    return this.instagramService.postContent(data, user.id);
  }
}

