import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ContextService } from './context.service';
import { GithubService } from '../github/github.service';
import { DatabaseService } from '../database/database.service';

@Controller('context')
export class ContextController {
  constructor(
    private readonly contextService: ContextService,
    private readonly github: GithubService,
    private readonly db: DatabaseService,
  ) {}

  @Get()
  async list(
    @Req() request: Request,
    @Query('q') query?: string,
    @Query('type') type?: string,
  ) {
    const user = await this.github.currentUser(
      this.cookie(request, 'contextops_session'),
    );
    return this.contextService.list(
      user.id,
      query,
      type,
      await this.activeRef(user.id),
    );
  }

  @Get(':id')
  async getById(@Req() request: Request, @Param('id') id: string) {
    const user = await this.github.currentUser(
      this.cookie(request, 'contextops_session'),
    );
    const records = await this.contextService.list(
      user.id,
      undefined,
      undefined,
      await this.activeRef(user.id),
    );
    const record = records.items.find((item) => item.id === id);
    if (!record)
      throw new NotFoundException(`Context record "${id}" was not found.`);
    return record;
  }

  private async activeRef(userId: string) {
    const result = await this.db.query<{ github_commit_sha: string }>(
      `SELECT r.github_commit_sha FROM active_context_releases r
       JOIN connected_projects p ON p.id=r.project_id WHERE p.user_id=$1 LIMIT 1`,
      [userId],
    );
    return result.rows[0]?.github_commit_sha;
  }

  private cookie(request: Request, name: string) {
    const raw = request.headers.cookie ?? '';
    const found = raw
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));
    if (!found) throw new UnauthorizedException('Please sign in with GitHub.');
    return decodeURIComponent(found.slice(name.length + 1));
  }
}
