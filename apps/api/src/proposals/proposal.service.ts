import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { GithubService } from '../github/github.service';
import { CONTEXT_TYPES, type ContextType } from '../context/context.types';
import matter from 'gray-matter';
import { ContextService } from '../context/context.service';
import {
  contentSummary,
  legacyContent,
  legacyFields,
  missingApprovalFields,
  parseContent,
  readContent,
  type ContextContent,
} from '../context/context-content';

export type ProposalInput = {
  title: string;
  type: ContextType;
  content: ContextContent;
  tags: string[];
  sourceReferences: string[];
};

type ProposalRow = {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  type: ContextType;
  status: string;
  content: unknown;
  question: string | null;
  summary: string | null;
  rationale: string | null;
  constraints: string[] | null;
  alternatives: string[] | null;
  discussion_summary: string | null;
  tags: string[] | null;
  source_references: string[] | null;
  owner: string;
  created_at: string;
  updated_at: string;
  published_path: string | null;
  published_commit_sha: string | null;
  review_note: string | null;
};

@Injectable()
export class ProposalService {
  constructor(
    private readonly db: DatabaseService,
    private readonly github: GithubService,
    private readonly context: ContextService,
  ) {}

  async list(userId: string, statuses = ['draft']) {
    const project = await this.project(userId);
    const result = await this.db.query<ProposalRow>(
      `SELECT p.*, u.github_login AS owner FROM context_proposals p
       JOIN app_users u ON u.id = p.user_id
       WHERE p.project_id = $1
       AND p.status = ANY($2::text[]) ORDER BY p.updated_at DESC`,
      [project.id, statuses],
    );
    const canReview = project.role !== 'contributor';
    return {
      items: result.rows.map((row) => ({
        ...this.client(row),
        canEdit: canReview || row.user_id === userId,
        canReview,
      })),
    };
  }

  async createDraft(userId: string, owner: string, body: unknown) {
    const project = await this.project(userId);
    const input = this.parse(body);
    const row = await this.db.query<ProposalRow>(
      `INSERT INTO context_proposals (user_id,project_id,title,type,content,tags,source_references,question,summary,rationale,constraints,alternatives,discussion_summary)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *, $14::text AS owner`,
      [
        userId,
        project.id,
        input.title,
        input.type,
        JSON.stringify(input.content),
        input.tags,
        input.sourceReferences,
        ...this.legacy(input),
        owner,
      ],
    );
    return this.client(row.rows[0]);
  }

  async update(userId: string, id: string, body: unknown) {
    const project = await this.project(userId);
    const input = this.parse(body);
    const result = await this.db.query<ProposalRow>(
      `UPDATE context_proposals SET title=$1,type=$2,content=$3::jsonb,tags=$4,source_references=$5,question=$6,summary=$7,rationale=$8,constraints=$9,alternatives=$10,discussion_summary=$11,updated_at=NOW()
       WHERE id=$12 AND project_id=$13
       AND ($14::boolean OR user_id=$15) AND status='draft'
       RETURNING *, (SELECT github_login FROM app_users WHERE id=user_id) AS owner`,
      [
        input.title,
        input.type,
        JSON.stringify(input.content),
        input.tags,
        input.sourceReferences,
        ...this.legacy(input),
        id,
        project.id,
        project.role !== 'contributor',
        userId,
      ],
    );
    if (!result.rowCount)
      throw new NotFoundException('That draft was not found.');
    return this.client(result.rows[0]);
  }

  async review(
    userId: string,
    id: string,
    decision: 'approve' | 'reject',
    note = '',
  ) {
    const project = await this.project(userId);
    if (project.role === 'contributor') {
      throw new ForbiddenException(
        'A reviewer or project owner must approve proposals.',
      );
    }
    const found = await this.db.query<ProposalRow>(
      `SELECT p.*,u.github_login AS owner FROM context_proposals p
       JOIN app_users u ON u.id=p.user_id
       WHERE p.id=$1 AND p.project_id=$2 AND p.status='draft'`,
      [id, project.id],
    );
    if (!found.rowCount)
      throw new NotFoundException('That draft was not found.');
    const p = found.rows[0];
    if (decision === 'reject') {
      const out = await this.db.query<ProposalRow>(
        `UPDATE context_proposals SET status='rejected',reviewed_at=NOW(),review_note=$3,updated_at=NOW()
         WHERE id=$1 AND project_id=$2 RETURNING *,
         (SELECT github_login FROM app_users WHERE id=context_proposals.user_id) AS owner`,
        [id, project.id, note.slice(0, 2000)],
      );
      return this.client(out.rows[0]);
    }
    let content = this.rowContent(p);
    const type = p.type;
    const missing = missingApprovalFields(
      type,
      content,
      p.source_references ?? [],
    );
    if (missing.length)
      throw new BadRequestException(
        `Complete these ${p.type} fields before approval: ${missing.join(', ')}.`,
      );
    if (type === 'project-state' && !content.asOf) {
      content = { ...content, asOf: new Date().toISOString().slice(0, 10) };
    }
    const legacy = legacyFields(type, content);
    const published = await this.github.publishContextRecord(
      project.ownerUserId,
      {
        schemaVersion: 2,
        id: p.id,
        projectId: project.id,
        title: p.title,
        type: p.type,
        status: 'approved',
        reviewStatus: 'approved',
        updatedAt: new Date().toISOString().slice(0, 10),
        owner: p.owner,
        content,
        ...legacy,
        tags: p.tags ?? [],
        sourceReferences: p.source_references ?? [],
      },
    );
    await this.db.query(
      `INSERT INTO active_context_releases(project_id,github_commit_sha,branch,updated_at)
       VALUES($1,$2,$3,NOW()) ON CONFLICT(project_id) DO UPDATE SET
       github_commit_sha=EXCLUDED.github_commit_sha,branch=EXCLUDED.branch,updated_at=NOW()`,
      [project.id, published.commitSha, published.branch],
    );
    const out = await this.db.query<ProposalRow>(
      `UPDATE context_proposals SET status='approved',reviewed_at=NOW(),review_note=$3,published_path=$4,published_commit_sha=$5,updated_at=NOW()
       WHERE id=$1 AND project_id=$2 AND status='draft' RETURNING *,
       (SELECT github_login FROM app_users WHERE id=context_proposals.user_id) AS owner`,
      [
        id,
        project.id,
        note.slice(0, 2000),
        published.path,
        published.commitSha,
      ],
    );
    if (!out.rowCount)
      throw new NotFoundException('That draft was already reviewed.');
    return this.client(out.rows[0]);
  }

  async conflicts(userId: string, id: string) {
    const project = await this.project(userId);
    const result = await this.db.query<ProposalRow>(
      `SELECT id,title,type,content,question,summary,rationale,constraints,alternatives,discussion_summary,source_references
       FROM context_proposals WHERE id=$1 AND project_id=$2 AND status='draft'`,
      [id, project.id],
    );
    if (!result.rowCount)
      throw new NotFoundException('That draft was not found.');
    const candidate = result.rows[0];
    const candidateContent = this.rowContent(candidate);
    const candidateLegacy = legacyFields(candidate.type, candidateContent);
    const key = (value: string) =>
      value
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    const source = await this.github.readContextFiles(project.ownerUserId);
    const matches = [] as Array<{
      path: string;
      title: string;
      summary: string;
    }>;
    for (const file of source.files) {
      try {
        const parsed = matter(file.content);
        const data = parsed.data as Record<string, unknown>;
        if (data.status !== 'approved') continue;
        const title = this.text(data.title);
        const question = this.text(data.question, this.text(data.problem));
        const type = this.text(data.type) as ContextType;
        const contextContent =
          type && CONTEXT_TYPES.includes(type)
            ? readContent(type, data.content)
            : ({} as ContextContent);
        const summary =
          Object.keys(contextContent).length > 0
            ? contentSummary(type, contextContent)
            : this.text(data.summary, this.text(data.outcome));
        const sameTopic =
          (key(title) !== '' && key(title) === key(candidate.title)) ||
          (key(question) !== '' &&
            key(question) === key(candidateLegacy.question));
        if (sameTopic && key(summary) !== key(candidateLegacy.summary))
          matches.push({ path: file.path, title, summary });
      } catch {
        /* malformed repository records are already reported by the library reader */
      }
    }
    return { matches };
  }

  async releaseHistory(userId: string) {
    const project = await this.project(userId);
    const active = await this.db.query<{
      github_commit_sha: string;
      branch: string;
    }>(
      `SELECT github_commit_sha,branch FROM active_context_releases WHERE project_id=$1`,
      [project.id],
    );
    const history = await this.github.listContextCommits(project.ownerUserId);
    const rollbacks = await this.db.query<{
      from_commit_sha: string;
      to_commit_sha: string;
      branch: string;
      created_at: string;
      actor: string;
    }>(
      `SELECT r.from_commit_sha,r.to_commit_sha,r.branch,r.created_at,u.github_login AS actor
       FROM context_release_rollbacks r JOIN app_users u ON u.id=r.actor_user_id
       WHERE r.project_id=$1 ORDER BY r.created_at DESC LIMIT 20`,
      [project.id],
    );
    return {
      ...history,
      activeCommitSha: active.rows[0]?.github_commit_sha ?? null,
      items: history.items.map((item) => ({
        ...item,
        isActive: item.sha === active.rows[0]?.github_commit_sha,
      })),
      rollbacks: rollbacks.rows.map((item) => ({
        fromCommitSha: item.from_commit_sha,
        toCommitSha: item.to_commit_sha,
        branch: item.branch,
        createdAt: item.created_at,
        actor: item.actor,
      })),
    };
  }

  async rollbackRelease(userId: string, targetSha: string) {
    if (!/^[a-f0-9]{40}$/i.test(targetSha)) {
      throw new BadRequestException('Choose a valid GitHub commit.');
    }
    const project = await this.project(userId);
    if (project.role === 'contributor') {
      throw new ForbiddenException(
        'A reviewer or project owner must restore releases.',
      );
    }
    const history = await this.github.listContextCommits(project.ownerUserId);
    const target = history.items.find(
      (item) => item.sha.toLowerCase() === targetSha.toLowerCase(),
    );
    if (!target)
      throw new BadRequestException(
        'That commit is not part of this repository’s context history.',
      );
    const active = await this.db.query<{ github_commit_sha: string }>(
      `SELECT github_commit_sha FROM active_context_releases WHERE project_id=$1`,
      [project.id],
    );
    const fromSha = active.rows[0]?.github_commit_sha;
    if (!fromSha)
      throw new BadRequestException(
        'There is no active context release to restore from.',
      );
    if (fromSha === target.sha)
      throw new BadRequestException('That release is already active.');

    const restored = await this.db.query(
      `WITH updated AS (
         UPDATE active_context_releases
         SET github_commit_sha=$1,branch=$2,updated_at=NOW()
         WHERE project_id=$3 AND github_commit_sha=$4
         RETURNING project_id,github_commit_sha
       )
       INSERT INTO context_release_rollbacks(project_id,from_commit_sha,to_commit_sha,branch,actor_user_id)
       SELECT project_id,$4,github_commit_sha,$2,$5 FROM updated
       RETURNING id`,
      [target.sha, history.branch, project.id, fromSha, userId],
    );
    if (!restored.rowCount)
      throw new BadRequestException(
        'The active version changed while restoring. Refresh the history and try again.',
      );
    return {
      activeCommitSha: target.sha,
      branch: history.branch,
      message:
        'The active context version was restored. GitHub history was preserved.',
    };
  }

  async createToken(userId: string) {
    const raw = `ctxops_${randomBytes(32).toString('base64url')}`;
    const hash = createHash('sha256').update(raw).digest('hex');
    await this.db.query(
      `UPDATE mcp_access_tokens SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL`,
      [userId],
    );
    const result = await this.db.query<{
      id: string;
      token_prefix: string;
      created_at: string;
    }>(
      `INSERT INTO mcp_access_tokens(user_id,token_hash,token_prefix) VALUES($1,$2,$3) RETURNING id,token_prefix,created_at`,
      [userId, hash, raw.slice(0, 14)],
    );
    return { ...result.rows[0], token: raw };
  }
  async tokenInfo(userId: string) {
    const result = await this.db.query<{
      token_prefix: string;
      created_at: string;
      last_used_at: string | null;
    }>(
      `SELECT token_prefix,created_at,last_used_at FROM mcp_access_tokens WHERE user_id=$1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }
  async revokeToken(userId: string) {
    await this.db.query(
      `UPDATE mcp_access_tokens SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL`,
      [userId],
    );
  }
  async userForToken(token: string) {
    const hash = createHash('sha256').update(token).digest('hex');
    const row = await this.db.query<{ user_id: string }>(
      `UPDATE mcp_access_tokens SET last_used_at=NOW() WHERE token_hash=$1 AND revoked_at IS NULL RETURNING user_id`,
      [hash],
    );
    return row.rows[0]?.user_id ?? null;
  }

  async searchApprovedContext(userId: string, query?: string, type?: string) {
    const project = await this.project(userId);
    let release = await this.db.query<{
      github_commit_sha: string;
      branch: string;
    }>(
      `SELECT github_commit_sha,branch FROM active_context_releases WHERE project_id=$1`,
      [project.id],
    );
    if (!release.rowCount) {
      const head = await this.github.currentContextHead(project.ownerUserId);
      await this.db.query(
        `INSERT INTO active_context_releases(project_id,github_commit_sha,branch) VALUES($1,$2,$3) ON CONFLICT(project_id) DO NOTHING`,
        [project.id, head.commitSha, head.branch],
      );
      release = await this.db.query<{
        github_commit_sha: string;
        branch: string;
      }>(
        `SELECT github_commit_sha,branch FROM active_context_releases WHERE project_id=$1`,
        [project.id],
      );
    }
    const version = release.rows[0];
    const result = await this.context.list(
      project.ownerUserId,
      query,
      type,
      version.github_commit_sha,
    );
    return {
      repository: result.repository,
      branch: version.branch,
      version: version.github_commit_sha,
      total: result.total,
      items: result.items.map((item) => ({ ...item, source: item.sourcePath })),
    };
  }

  private async project(userId: string) {
    const result = await this.db.query<{
      id: string;
      owner_user_id: string;
      role: 'owner' | 'reviewer' | 'contributor';
    }>(
      `SELECT cp.id,cp.user_id AS owner_user_id,pm.role
       FROM project_members pm JOIN connected_projects cp ON cp.id=pm.project_id
       WHERE pm.user_id=$1 LIMIT 1`,
      [userId],
    );
    if (!result.rowCount)
      throw new NotFoundException('Connect a project before using proposals.');
    return {
      id: result.rows[0].id,
      ownerUserId: result.rows[0].owner_user_id,
      role: result.rows[0].role,
    };
  }
  private parse(body: unknown): ProposalInput {
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('Enter proposal details.');
    const b = body as Record<string, unknown>;
    const txt = (k: string, max: number) => {
      const v = b[k];
      if (v == null) return '';
      if (typeof v !== 'string' || v.length > max)
        throw new BadRequestException(`Check the ${k} field.`);
      return v.trim();
    };
    const list = (k: string, max: number, itemMax: number) => {
      const v = b[k];
      if (v == null) return [];
      if (
        !Array.isArray(v) ||
        v.length > max ||
        v.some((x) => typeof x !== 'string' || x.length > itemMax)
      )
        throw new BadRequestException(`Check the ${k} list.`);
      return (v as string[]).map((x) => x.trim()).filter(Boolean);
    };
    const type = txt('type', 40);
    if (!CONTEXT_TYPES.includes(type as ContextType))
      throw new BadRequestException('Choose a valid context type.');
    const title = txt('title', 180);
    if (!title) throw new BadRequestException('Add a title.');
    let content: ContextContent;
    try {
      content =
        b.content === undefined
          ? legacyContent(type as ContextType, b)
          : parseContent(type as ContextType, b.content);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Check the proposal content.',
      );
    }
    return {
      title,
      type: type as ContextType,
      content,
      tags: list('tags', 30, 80),
      sourceReferences: list('sourceReferences', 50, 1000),
    };
  }

  private legacy(input: ProposalInput) {
    const fields = legacyFields(input.type, input.content);
    return [
      fields.question,
      fields.summary,
      fields.rationale,
      fields.constraints,
      fields.alternatives,
      fields.discussionSummary,
    ];
  }

  private rowContent(row: Record<string, unknown>): ContextContent {
    const type = row.type as ContextType;
    const content = readContent(type, row.content);
    return Object.keys(content).length > 0 ? content : legacyContent(type, row);
  }

  private text(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
  }

  private client(r: ProposalRow) {
    const content = this.rowContent(r);
    const legacy = legacyFields(r.type, content);
    return {
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      type: r.type,
      status: r.status,
      content,
      question: legacy.question,
      summary: legacy.summary,
      rationale: legacy.rationale,
      tags: r.tags ?? [],
      constraints: legacy.constraints,
      alternatives: legacy.alternatives,
      discussionSummary: legacy.discussionSummary,
      sourceReferences: r.source_references ?? [],
      owner: r.owner,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      publishedPath: r.published_path,
      publishedCommitSha: r.published_commit_sha,
      reviewNote: r.review_note,
    };
  }
}
