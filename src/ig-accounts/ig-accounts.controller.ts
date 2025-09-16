import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { IgAccountsService } from './ig-accounts.service';
import { CreateIgAccountDto } from './dto/create-ig-account.dto';
import { UpdateIgAccountDto } from './dto/update-ig-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('users/ig-accounts')
@UseGuards(JwtAuthGuard)
export class IgAccountsController {
  constructor(private readonly igAccountsService: IgAccountsService) {}

  @Post()
  create(@GetUser() user: any, @Body() createIgAccountDto: CreateIgAccountDto) {
    return this.igAccountsService.create(user.id, createIgAccountDto);
  }

  @Get()
  findAll(@GetUser() user: any) {
    return this.igAccountsService.findAllByUser(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: any) {
    return this.igAccountsService.findOne(+id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @GetUser() user: any,
    @Body() updateIgAccountDto: UpdateIgAccountDto,
  ) {
    return this.igAccountsService.update(+id, user.id, updateIgAccountDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetUser() user: any) {
    return this.igAccountsService.remove(+id, user.id);
  }
}

