import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { GithubService } from '../github/github.service';

type ProjectRow = {
  id: string;
  user_id: string;
  installation_id: string;
  repository_id: string;
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  is_private: boolean;
  default_branch: string;
  context_status: 'unchecked' | 'missing' | 'ready';
  connection_status:
    'connected' | 'revoked' | 'suspended' | 'repository_access_removed';
  last_verified_at: Date | null;
  connected_at?: Date;
  account_login?: string;
  member_role?: 'owner' | 'reviewer' | 'contributor';
};

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly db: DatabaseService,
    private readonly github: GithubService,
  ) {}

  @Post('connect')
  async connect(
    @Req() request: Request,
    @Body() body: { repositoryId?: number },
    @Headers('origin') origin?: string,
  ) {
    this.requireSameOrigin(origin);
    const user = await this.currentUser(request);
    const membership = await this.db.query<{ role: string }>(
      'SELECT role FROM project_members WHERE user_id=$1 LIMIT 1',
      [user.id],
    );
    if (membership.rowCount && membership.rows[0].role !== 'owner') {
      throw new ForbiddenException(
        'Only the project owner can change the connected repository.',
      );
    }
    if (
      !Number.isSafeInteger(body.repositoryId) ||
      Number(body.repositoryId) <= 0
    ) {
      throw new BadRequestException('Choose a GitHub repository to continue.');
    }
    const { repo, installationId, token } =
      await this.github.selectedInstallation(
        user.id,
        Number(body.repositoryId),
      );
    const contextExists = await this.github.contextFolderExists(
      token,
      repo.owner.login,
      repo.name,
    );
    const result = await this.db.query<ProjectRow>(
      `INSERT INTO connected_projects
         (user_id, installation_id, repository_id, owner, name, full_name, description, is_private, default_branch, context_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id) DO UPDATE SET
         installation_id = EXCLUDED.installation_id,
         owner = EXCLUDED.owner,
         name = EXCLUDED.name,
         full_name = EXCLUDED.full_name,
         description = EXCLUDED.description,
         is_private = EXCLUDED.is_private,
         default_branch = EXCLUDED.default_branch,
         context_status = EXCLUDED.context_status,
         connection_status = 'connected',
         last_verified_at = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [
        user.id,
        installationId,
        repo.id,
        repo.owner.login,
        repo.name,
        repo.full_name,
        repo.description,
        repo.private,
        repo.default_branch,
        contextExists ? 'ready' : 'missing',
      ],
    );
    await this.db.query(
      `INSERT INTO project_members(project_id,user_id,role,invited_by)
       VALUES($1,$2,'owner',$2)
       ON CONFLICT(project_id,user_id) DO UPDATE SET role='owner'`,
      [result.rows[0].id, user.id],
    );
    return this.toClient(result.rows[0]);
  }

  @Get('current')
  async current(@Req() request: Request) {
    const user = await this.currentUser(request);
    const result = await this.db.query<ProjectRow>(
      `SELECT cp.*, cp.created_at AS connected_at, gi.account_login,
              pm.role AS member_role
       FROM project_members pm
       JOIN connected_projects cp ON cp.id = pm.project_id
       LEFT JOIN github_installations gi ON gi.installation_id = cp.installation_id
       WHERE pm.user_id = $1 LIMIT 1`,
      [user.id],
    );
    if (!result.rowCount) return { project: null };
    const row = result.rows[0];
    let connectionStatus: string = row.connection_status ?? 'connected';
    let lastVerifiedAt = row.last_verified_at;
    const recentlyVerified = row.last_verified_at
      ? Date.now() - new Date(row.last_verified_at).getTime() < 60_000
      : false;
    if (!recentlyVerified) {
      try {
        connectionStatus = await this.github.verifyProjectConnection(
          row.installation_id,
          row.repository_id,
        );
        await this.db.query(
          `UPDATE connected_projects
           SET connection_status = $1, last_verified_at = NOW()
           WHERE id = $2`,
          [connectionStatus, row.id],
        );
        lastVerifiedAt = new Date();
      } catch {
        connectionStatus =
          row.connection_status === 'connected'
            ? 'verification_unavailable'
            : row.connection_status;
      }
    }
    return {
      project: {
        ...this.toClient(row),
        connectionStatus,
        accountLogin: row.account_login ?? null,
        connectedAt: row.connected_at,
        lastVerifiedAt,
        repositoryUrl: `https://github.com/${encodeURIComponent(row.owner)}/${encodeURIComponent(row.name)}`,
      },
    };
  }

  @Get('team')
  async team(@Req() request: Request) {
    const user = await this.currentUser(request);
    const project = await this.memberProject(user.id);
    const members = await this.db.query<{
      id: string;
      github_login: string;
      avatar_url: string | null;
      role: 'owner' | 'reviewer' | 'contributor';
      created_at: string;
    }>(
      `SELECT u.id,u.github_login,u.avatar_url,pm.role,pm.created_at
       FROM project_members pm JOIN app_users u ON u.id=pm.user_id
       WHERE pm.project_id=$1
       ORDER BY CASE pm.role WHEN 'owner' THEN 0 WHEN 'reviewer' THEN 1 ELSE 2 END,
                pm.created_at`,
      [project.id],
    );
    return {
      role: project.role,
      members: members.rows.map((member) => ({
        id: member.id,
        login: member.github_login,
        avatarUrl: member.avatar_url,
        role: member.role,
        joinedAt: member.created_at,
      })),
    };
  }

  @Post('invitations')
  async invite(
    @Req() request: Request,
    @Body() body: { role?: string },
    @Headers('origin') origin?: string,
  ) {
    this.requireSameOrigin(origin);
    const user = await this.currentUser(request);
    const project = await this.memberProject(user.id);
    if (project.role !== 'owner') {
      throw new ForbiddenException(
        'Only the project owner can invite members.',
      );
    }
    const role = body.role === 'reviewer' ? 'reviewer' : 'contributor';
    const token = randomBytes(32).toString('base64url');
    await this.db.query(
      `INSERT INTO project_invitations(project_id,token_hash,role,created_by,expires_at)
       VALUES($1,$2,$3,$4,NOW()+INTERVAL '7 days')`,
      [project.id, this.hash(token), role, user.id],
    );
    const webOrigin = (
      process.env.WEB_ORIGIN ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    return {
      inviteUrl: `${webOrigin}/join/${encodeURIComponent(token)}`,
      role,
      expiresInDays: 7,
    };
  }

  @Post('invitations/accept')
  async acceptInvitation(
    @Req() request: Request,
    @Body() body: { token?: string },
    @Headers('origin') origin?: string,
  ) {
    this.requireSameOrigin(origin);
    const user = await this.currentUser(request);
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
      throw new BadRequestException('This invitation link is invalid.');
    }
    const invitation = await this.db.query<{
      id: string;
      project_id: string;
      role: 'reviewer' | 'contributor';
    }>(
      `SELECT id,project_id,role FROM project_invitations
       WHERE token_hash=$1 AND accepted_at IS NULL AND expires_at>NOW()
       FOR UPDATE`,
      [this.hash(token)],
    );
    if (!invitation.rowCount) {
      throw new BadRequestException(
        'This invitation has expired or was already used.',
      );
    }
    const existing = await this.db.query(
      'SELECT 1 FROM project_members WHERE user_id=$1 LIMIT 1',
      [user.id],
    );
    if (existing.rowCount) {
      throw new ConflictException('Your account already belongs to a project.');
    }
    const invite = invitation.rows[0];
    const joined = await this.db.query(
      `WITH claimed AS (
         UPDATE project_invitations
         SET accepted_by=$2,accepted_at=NOW()
         WHERE id=$1 AND accepted_at IS NULL
         RETURNING project_id,role,created_by
       )
       INSERT INTO project_members(project_id,user_id,role,invited_by)
       SELECT project_id,$2,role,created_by FROM claimed
       RETURNING project_id`,
      [invite.id, user.id],
    );
    if (!joined.rowCount) {
      throw new ConflictException('This invitation was already accepted.');
    }
    return { joined: true, projectId: invite.project_id, role: invite.role };
  }

  @Post(':id/initialize-context')
  async initializeContext(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @Headers('origin') origin?: string,
  ) {
    this.requireSameOrigin(origin);
    const user = await this.currentUser(request);
    const result = await this.db.query<ProjectRow>(
      'SELECT * FROM connected_projects WHERE id = $1 AND user_id = $2',
      [projectId, user.id],
    );
    if (!result.rowCount)
      throw new BadRequestException('Choose a connected project first.');
    const project = result.rows[0];
    const access = await this.github.selectedInstallation(
      user.id,
      Number(project.repository_id),
    );
    await this.github.createContextReadme(
      access.token,
      project.owner,
      project.name,
      project.default_branch,
    );
    await this.db.query(
      "UPDATE connected_projects SET context_status = 'ready', updated_at = NOW() WHERE id = $1",
      [project.id],
    );
    return { project: { ...this.toClient(project), contextStatus: 'ready' } };
  }

  private async currentUser(request: Request) {
    const session = this.cookie(request, 'contextops_session');
    return this.github.currentUser(session);
  }

  private async memberProject(userId: string) {
    const result = await this.db.query<{
      id: string;
      role: 'owner' | 'reviewer' | 'contributor';
    }>(
      `SELECT cp.id,pm.role FROM project_members pm
       JOIN connected_projects cp ON cp.id=pm.project_id
       WHERE pm.user_id=$1 LIMIT 1`,
      [userId],
    );
    if (!result.rowCount)
      throw new BadRequestException('Join or connect a project first.');
    return result.rows[0];
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private cookie(request: Request, name: string) {
    const raw = request.headers.cookie ?? '';
    for (const part of raw.split(';')) {
      const [key, ...value] = part.trim().split('=');
      if (key === name) return decodeURIComponent(value.join('='));
    }
    throw new UnauthorizedException('Please sign in with GitHub.');
  }

  private requireSameOrigin(origin?: string) {
    if (origin !== (process.env.WEB_ORIGIN ?? 'http://localhost:3000')) {
      throw new ForbiddenException(
        'This request did not come from the ContextOps app.',
      );
    }
  }

  private toClient(project: ProjectRow) {
    return {
      id: project.id,
      repositoryId: Number(project.repository_id),
      fullName: project.full_name,
      owner: project.owner,
      name: project.name,
      description: project.description,
      isPrivate: project.is_private,
      defaultBranch: project.default_branch,
      contextStatus: project.context_status,
      connectionStatus: project.connection_status ?? 'connected',
      role: project.member_role ?? 'owner',
    };
  }
}
