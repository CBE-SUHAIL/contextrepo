import type { ContextType } from './context.types';

export type ContentValue = string | string[];
export type ContextContent = Record<string, ContentValue>;

export const CONTENT_FIELDS: Record<ContextType, string[]> = {
  decision: [
    'problem',
    'drivers',
    'outcome',
    'rationale',
    'constraints',
    'alternatives',
    'consequences',
    'revisitWhen',
  ],
  requirement: [
    'statement',
    'rationale',
    'origin',
    'acceptanceCriteria',
    'priority',
  ],
  constraint: [
    'statement',
    'scope',
    'source',
    'rationale',
    'impact',
    'verificationCriteria',
  ],
  research: [
    'question',
    'scope',
    'method',
    'findings',
    'confidence',
    'limitations',
    'implications',
    'recommendation',
  ],
  'rejected-approach': [
    'approach',
    'context',
    'reasonRejected',
    'evidence',
    'chosenAlternative',
    'reconsiderIf',
  ],
  'open-question': [
    'question',
    'whyItMatters',
    'knownFacts',
    'unknowns',
    'optionsDiscussed',
    'nextStep',
    'targetDate',
  ],
  'project-state': [
    'asOf',
    'health',
    'summary',
    'completed',
    'inProgress',
    'blockers',
    'risks',
    'nextSteps',
    'decisionsNeeded',
  ],
};

const LIST_FIELDS = new Set([
  'drivers',
  'constraints',
  'alternatives',
  'consequences',
  'acceptanceCriteria',
  'verificationCriteria',
  'findings',
  'limitations',
  'implications',
  'evidence',
  'knownFacts',
  'unknowns',
  'optionsDiscussed',
  'completed',
  'inProgress',
  'blockers',
  'risks',
  'nextSteps',
  'decisionsNeeded',
]);

const APPROVAL_FIELDS: Record<ContextType, string[]> = {
  decision: ['problem', 'outcome', 'rationale'],
  requirement: ['statement', 'acceptanceCriteria'],
  constraint: ['statement', 'scope'],
  research: ['question', 'findings'],
  'rejected-approach': ['approach', 'reasonRejected'],
  'open-question': ['question', 'whyItMatters'],
  'project-state': ['health', 'summary'],
};

export function parseContent(
  type: ContextType,
  value: unknown,
): ContextContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Proposal content must be an object.');
  }

  const input = value as Record<string, unknown>;
  const allowed = new Set(CONTENT_FIELDS[type]);
  const unknown = Object.keys(input).find((key) => !allowed.has(key));
  if (unknown)
    throw new Error(`The ${unknown} field does not apply to this type.`);

  const content: ContextContent = {};
  for (const key of CONTENT_FIELDS[type]) {
    const field = input[key];
    if (field === undefined || field === null) continue;
    if (LIST_FIELDS.has(key)) {
      if (
        !Array.isArray(field) ||
        field.length > 100 ||
        field.some((item) => typeof item !== 'string' || item.length > 2000)
      ) {
        throw new Error(`Check the ${key} list.`);
      }
      const entries = field.map((item) => item.trim()).filter(Boolean);
      if (entries.length) content[key] = entries;
    } else {
      if (typeof field !== 'string' || field.length > 10000) {
        throw new Error(`Check the ${key} field.`);
      }
      const text = field.trim();
      if (text) content[key] = text;
    }
  }
  return content;
}

export function readContent(type: ContextType, value: unknown): ContextContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const content: ContextContent = {};
  for (const key of CONTENT_FIELDS[type]) {
    const field = input[key];
    if (LIST_FIELDS.has(key) && Array.isArray(field)) {
      content[key] = field.filter(
        (item): item is string => typeof item === 'string',
      );
    } else if (typeof field === 'string') {
      content[key] = field;
    }
  }
  return content;
}

export function legacyContent(
  type: ContextType,
  record: Record<string, unknown>,
) {
  const question = text(record.question ?? record.problem);
  const summary = text(record.summary ?? record.outcome);
  const rationale = text(record.rationale);
  const constraints = strings(record.constraints);
  const alternatives = strings(record.alternatives);
  const notes = text(record.discussionSummary ?? record.discussion_summary);
  const references = strings(
    record.sourceReferences ?? record.source_references,
  );

  switch (type) {
    case 'decision':
      return compact({
        problem: question,
        outcome: summary,
        rationale,
        constraints,
        alternatives,
      });
    case 'requirement':
      return compact({
        statement: summary || question,
        rationale,
        origin: references.join('\n'),
      });
    case 'constraint':
      return compact({
        statement: summary || question,
        scope: notes,
        source: references.join('\n'),
        rationale,
      });
    case 'research':
      return compact({
        question,
        method: notes,
        findings: summary ? [summary] : [],
        limitations: [],
      });
    case 'rejected-approach':
      return compact({
        approach: summary,
        context: question,
        reasonRejected: rationale,
        evidence: references,
      });
    case 'open-question':
      return compact({
        question,
        whyItMatters: rationale,
        knownFacts: summary ? [summary] : [],
        optionsDiscussed: alternatives,
      });
    case 'project-state':
      return compact({
        asOf: text(record.updatedAt ?? record.updated_at),
        health: 'unknown',
        summary,
        blockers: constraints,
      });
  }
}

export function legacyFields(type: ContextType, content: ContextContent) {
  const string = (key: string) => text(content[key]);
  const list = (key: string) => strings(content[key]);
  switch (type) {
    case 'decision':
      return {
        question: string('problem'),
        summary: string('outcome'),
        rationale: string('rationale'),
        constraints: list('constraints'),
        alternatives: list('alternatives'),
        discussionSummary: '',
      };
    case 'requirement':
      return {
        question: string('statement'),
        summary: string('statement'),
        rationale: string('rationale'),
        constraints: [],
        alternatives: [],
        discussionSummary: string('origin'),
      };
    case 'constraint':
      return {
        question: string('statement'),
        summary: string('statement'),
        rationale: string('rationale'),
        constraints: [string('statement')].filter(Boolean),
        alternatives: [],
        discussionSummary: string('scope'),
      };
    case 'research':
      return {
        question: string('question'),
        summary: list('findings').join('\n'),
        rationale: string('recommendation'),
        constraints: [],
        alternatives: [],
        discussionSummary: string('method'),
      };
    case 'rejected-approach':
      return {
        question: string('context'),
        summary: string('approach'),
        rationale: string('reasonRejected'),
        constraints: [],
        alternatives: list('evidence'),
        discussionSummary: string('reconsiderIf'),
      };
    case 'open-question':
      return {
        question: string('question'),
        summary: list('knownFacts').join('\n') || string('question'),
        rationale: string('whyItMatters'),
        constraints: list('unknowns'),
        alternatives: list('optionsDiscussed'),
        discussionSummary: string('nextStep'),
      };
    case 'project-state':
      return {
        question: string('health'),
        summary: string('summary'),
        rationale: '',
        constraints: list('blockers'),
        alternatives: list('nextSteps'),
        discussionSummary:
          `Completed: ${list('completed').join('; ')}\nIn progress: ${list('inProgress').join('; ')}`.trim(),
      };
  }
}

export function missingApprovalFields(
  type: ContextType,
  content: ContextContent,
  sourceReferences: string[] = [],
) {
  const missing = APPROVAL_FIELDS[type].filter((key) => {
    const value = content[key];
    return Array.isArray(value)
      ? value.length === 0
      : !String(value ?? '').trim();
  });
  if (type === 'research' && sourceReferences.length === 0) {
    missing.push('sourceReferences');
  }
  return missing;
}

export function contentSummary(type: ContextType, content: ContextContent) {
  const values = legacyFields(type, content);
  return values.summary || values.question || values.rationale || '';
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function compact(fields: Record<string, ContentValue>): ContextContent {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) =>
      Array.isArray(value) ? value.length > 0 : Boolean(value),
    ),
  );
}
