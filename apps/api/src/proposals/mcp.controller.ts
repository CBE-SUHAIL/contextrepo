import {
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { ProposalService } from './proposal.service';
import type { ContextType } from '../context/context.types';

@Controller('mcp')
export class McpController {
  constructor(private readonly proposals: ProposalService) {}

  @Post()
  async handle(@Req() req: Request, @Res() res: Response) {
    const authorization = req.header('authorization') ?? '';
    const token = authorization.match(
      /^Bearer\s+(ctxops_[A-Za-z0-9_-]+)$/i,
    )?.[1];
    if (!token)
      throw new UnauthorizedException('Use a ContextOps MCP access token.');
    const userId = await this.proposals.userForToken(token);
    if (!userId)
      throw new UnauthorizedException(
        'This MCP access token is invalid or revoked.',
      );

    const server = new McpServer({ name: 'contextops', version: '1.0.0' });
    server.tool(
      'search_approved_context',
      'Search the active, approved project context snapshot. Drafts and rejected proposals are never returned. Results include the GitHub source path and pinned commit version.',
      {
        query: z.string().max(500).optional(),
        type: z
          .enum([
            'decision',
            'requirement',
            'constraint',
            'research',
            'rejected-approach',
            'open-question',
            'project-state',
          ])
          .optional(),
      },
      async ({ query, type }) => {
        const result = await this.proposals.searchApprovedContext(
          userId,
          query,
          type,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      },
    );
    server.tool(
      'submit_context_proposal',
      'Legacy submission tool for existing MCP clients. Prefer the type-specific submit_decision, submit_requirement, submit_constraint, submit_research, submit_rejected_approach, submit_open_question, or submit_project_state tool. This tool only saves a draft; a person must review it in ContextOps.',
      {
        title: z.string().min(1).max(180),
        type: z.enum([
          'decision',
          'requirement',
          'constraint',
          'research',
          'rejected-approach',
          'open-question',
          'project-state',
        ]),
        question: z.string().max(5000),
        summary: z.string().max(5000),
        rationale: z.string().max(10000),
        tags: z.array(z.string().max(80)).max(30).optional(),
        constraints: z.array(z.string().max(500)).max(50).optional(),
        alternatives: z.array(z.string().max(500)).max(50).optional(),
        discussionSummary: z.string().max(10000).optional(),
        sourceReferences: z.array(z.string().max(1000)).max(50).optional(),
      },
      async (input) => {
        const proposal = await this.proposals.createDraft(
          userId,
          'AI assistant',
          input,
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message:
                    'Draft saved in ContextOps for human review. It has not been approved or published.',
                  proposal,
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    );

    const textField = (description: string, max = 10000) =>
      z.string().max(max).optional().describe(description);
    const listField = (description: string) =>
      z.array(z.string().max(2000)).max(100).optional().describe(description);
    const shared = {
      title: z.string().min(1).max(180).describe('Short, factual title.'),
      tags: z.array(z.string().max(80)).max(30).optional(),
      sourceReferences: z.array(z.string().max(1000)).max(50).optional(),
    };
    const typedTools = [
      {
        name: 'submit_decision',
        type: 'decision',
        description:
          'Save a project decision draft. Use only when the team has an actual chosen outcome. If no outcome is chosen, use submit_open_question. Omit unknown fields; never invent alternatives or reasons.',
        fields: {
          problem: textField('Problem and context that required a decision.'),
          drivers: listField('Factors the team used to compare options.'),
          outcome: textField('The option the team actually chose.'),
          rationale: textField('Why the team chose this outcome.'),
          constraints: listField('Relevant project limits.'),
          alternatives: listField(
            'Options actually considered and their trade-offs.',
          ),
          consequences: listField('Expected positive and negative effects.'),
          revisitWhen: textField(
            'Condition that should trigger reconsidering the decision.',
          ),
        },
      },
      {
        name: 'submit_requirement',
        type: 'requirement',
        description:
          'Save a requirement draft describing a capability or condition the project must satisfy. Keep it specific and verifiable; do not use this for an external boundary (use submit_constraint).',
        fields: {
          statement: textField('One clear requirement statement.'),
          rationale: textField('Why this requirement is needed.'),
          origin: textField(
            'Source need, decision, or stakeholder request, if known.',
          ),
          acceptanceCriteria: listField(
            'Observable checks that show the requirement is met.',
          ),
          priority: textField('Priority only if the team supplied one.'),
        },
      },
      {
        name: 'submit_constraint',
        type: 'constraint',
        description:
          'Save a constraint draft recording a real boundary or limitation on the project. Do not turn a preference into a mandatory rule.',
        fields: {
          statement: textField('The specific must or must-not boundary.'),
          scope: textField(
            'Project area or situation where the boundary applies.',
          ),
          source: textField('Who or what imposed this boundary, if known.'),
          rationale: textField('Why the boundary exists, if known.'),
          impact: textField('What the boundary limits or affects.'),
          verificationCriteria: listField(
            'How compliance can be checked, if applicable.',
          ),
        },
      },
      {
        name: 'submit_research',
        type: 'research',
        description:
          'Save a research note, not a team decision. Separate observed findings from recommendations and include sources for factual claims.',
        fields: {
          question: textField('Question the research tried to answer.'),
          scope: textField('What was included or excluded.'),
          method: textField('How information was gathered or compared.'),
          findings: listField('Evidence-based findings.'),
          confidence: textField('Confidence in the findings and why.'),
          limitations: listField('Evidence gaps or limitations.'),
          implications: listField(
            'What the findings may mean for this project.',
          ),
          recommendation: textField(
            'Optional recommendation, clearly labeled as advice.',
          ),
        },
      },
      {
        name: 'submit_rejected_approach',
        type: 'rejected-approach',
        description:
          'Save an approach the team explicitly considered and rejected. Do not infer that an option was rejected or claim a different option was selected.',
        fields: {
          approach: textField('Approach the team considered and rejected.'),
          context: textField(
            'Problem or situation in which it was considered.',
          ),
          reasonRejected: textField('Recorded reason for rejecting it.'),
          evidence: listField(
            'Evidence or trade-offs that support the rejection.',
          ),
          chosenAlternative: textField(
            'What was chosen instead, only if the team said so.',
          ),
          reconsiderIf: textField(
            'Condition under which the team may reconsider it.',
          ),
        },
      },
      {
        name: 'submit_open_question',
        type: 'open-question',
        description:
          'Save an unresolved project question. The question may be published without an answer. Distinguish known facts from unknowns and never make up a resolution.',
        fields: {
          question: textField('The question that remains unresolved.'),
          whyItMatters: textField('Why the team needs to resolve it.'),
          knownFacts: listField(
            'Facts supported by the conversation or sources.',
          ),
          unknowns: listField('Information the team still needs.'),
          optionsDiscussed: listField(
            'Options actually discussed; omit if none were recorded.',
          ),
          nextStep: textField('Agreed next step, if one was identified.'),
          targetDate: textField('Target date, only if explicitly agreed.'),
        },
      },
      {
        name: 'submit_project_state',
        type: 'project-state',
        description:
          'Save a dated project progress update. Report only known current status, work, risks, blockers, and next steps. ContextOps supplies the update date.',
        fields: {
          health: textField(
            'Overall project health, if stated (for example on-track, at-risk, blocked).',
          ),
          summary: textField(
            'Short factual summary of the current project state.',
          ),
          completed: listField('Work completed.'),
          inProgress: listField('Work currently in progress.'),
          blockers: listField('Current blockers.'),
          risks: listField('Known risks.'),
          nextSteps: listField('Agreed next actions.'),
          decisionsNeeded: listField('Decisions still needed.'),
        },
      },
    ] as const;

    for (const tool of typedTools as unknown as Array<{
      name: string;
      type: ContextType;
      description: string;
      fields: z.ZodRawShape;
    }>) {
      server.tool(
        tool.name,
        `${tool.description} This tool saves a draft only; a person must review it in ContextOps before publication. Omit fields not supported by the source material.`,
        { ...shared, ...tool.fields },
        async (input: unknown) => {
          const body = input as Record<string, unknown>;
          const { title, tags, sourceReferences, ...content } = body;
          const proposal = await this.proposals.createDraft(
            userId,
            'AI assistant',
            {
              title: String(title ?? ''),
              type: tool.type,
              content,
              tags: Array.isArray(tags) ? tags : [],
              sourceReferences: Array.isArray(sourceReferences)
                ? sourceReferences
                : [],
            },
          );
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    message:
                      'Draft saved in ContextOps for human review. It has not been approved or published.',
                    proposal,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        },
      );
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
  }
}
