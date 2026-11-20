import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import matter from 'gray-matter';
import {
  CONTEXT_TYPES,
  type ContextRecord,
  type ContextReadResult,
  type ContextRepository,
  ContextType,
} from './context.types';
import { legacyContent } from './context-content';

@Injectable()
export class DemoContextRepository implements ContextRepository {
  private readonly root = process.env.CONTEXT_REPOSITORY_PATH
    ? resolve(process.env.CONTEXT_REPOSITORY_PATH)
    : resolve(process.cwd(), '../../examples/demo-context');

  async listApproved(): Promise<ContextReadResult> {
    const files = await this.findMarkdownFiles(this.root);
    const records = await Promise.all(
      files.map((file) => this.readRecord(file)),
    );

    return {
      items: records
        .filter((record) => record.status === 'approved')
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      repository: 'ContextOps demo',
      branch: 'main',
      commitSha: 'local-demo',
      contextFolderExists: true,
      warnings: [],
    };
  }

  private async findMarkdownFiles(directory: string): Promise<string[]> {
    let entries: Dirent[];

    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      throw new InternalServerErrorException(
        `Cannot read demo context at ${directory}. Set CONTEXT_REPOSITORY_PATH to a context folder.`,
        { cause: error },
      );
    }

    const nested = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = resolve(directory, entry.name);
        if (entry.isDirectory()) return this.findMarkdownFiles(fullPath);
        return entry.isFile() && entry.name.endsWith('.md') ? [fullPath] : [];
      }),
    );

    return nested.flat();
  }

  private async readRecord(file: string): Promise<ContextRecord> {
    const parsed = matter(await readFile(file, 'utf8'));
    const data = parsed.data as Record<string, unknown>;
    const type = data.type;

    if (
      typeof data.id !== 'string' ||
      typeof data.title !== 'string' ||
      typeof type !== 'string' ||
      !CONTEXT_TYPES.includes(type as ContextType)
    ) {
      throw new InternalServerErrorException(`Invalid context record: ${file}`);
    }

    return {
      id: data.id,
      title: data.title,
      type: type as ContextType,
      schemaVersion: 1,
      content: legacyContent(type as ContextType, data),
      projectId: this.stringValue(data.projectId, 'contextops-demo'),
      status: 'approved',
      updatedAt: this.stringValue(data.updatedAt),
      owner: this.stringValue(data.owner, 'ContextOps team'),
      tags: this.stringArray(data.tags),
      question: this.stringValue(data.question),
      summary: this.stringValue(data.summary, parsed.content.trim()),
      rationale: this.stringValue(data.rationale),
      constraints: this.stringArray(data.constraints),
      alternatives: this.stringArray(data.alternatives),
      discussionSummary: this.stringValue(data.discussionSummary),
      sourceReferences: this.stringArray(data.sourceReferences),
    };
  }

  private stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }

  private stringValue(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
  }
}
