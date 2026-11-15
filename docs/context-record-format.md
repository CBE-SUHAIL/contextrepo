# Context record format

ContextOps reads approved Markdown records from the `context/` folder in the connected GitHub repository's default branch. Subfolders are optional; the `type` field determines what a record means.

## Current format: type-specific records

New records use `schemaVersion: 2`. Common details stay in YAML front matter. The `content` object contains only fields that make sense for the record's type.

Example Open Question:

```markdown
---
schemaVersion: 2
id: database-choice-open
title: Database choice remains open
type: open-question
reviewStatus: approved
updatedAt: 2026-11-15
owner: Project team
tags:
  - database
sourceReferences:
  - context/database.md
content:
  question: Which database should the team use?
  whyItMatters: AI assistants need an approved answer before they can reliably use the team's database choice.
  knownFacts:
    - The approved PostgreSQL record is a test sample, not a team decision.
  unknowns:
    - The database the team will choose.
  optionsDiscussed: []
---
```

This is an example of the format only. It is not an approved WorkforceIntelligence decision. An empty list means no items were captured in that field; it does not claim that the team never discussed any.

Required common fields are `id`, `title`, `type`, `reviewStatus`, and `updatedAt`. `reviewStatus` must be `approved` to appear in the library. Common optional fields are `owner`, `projectId`, `tags`, and `sourceReferences`.

The required fields within `content` depend on `type`. For example, a Decision requires a problem, chosen outcome, and rationale; an Open Question requires a question and why it matters, but does not need an answer. See the [proposal type contract](proposal-type-contract.md) for all fields and approval requirements. Research records also need at least one source reference.

## Older format: flat records

ContextOps continues to read existing records that use the earlier format, without `schemaVersion: 2`:

```yaml
id: database-choice
title: Use PostgreSQL for application data
type: decision
status: approved
updatedAt: 2026-11-11
owner: Project team
question: Which database should the application use?
summary: Use PostgreSQL as the application's primary relational database.
rationale: The project needs relational data, transactions, and a mature ecosystem.
constraints:
  - The database must support reliable transactions.
alternatives:
  - MySQL
sourceReferences:
  - docs/architecture.md
```

Older records require `id`, `title`, `type`, `status: approved`, `updatedAt`, `question` (or `problem`), `summary` (or `outcome`), and `rationale`. Their common fields are adapted for display and search. New records should use the type-specific format above.

## Add or publish a record

Create a `.md` file under `context/`, or create and approve a draft in ContextOps. ContextOps publishes approved drafts under `context/<type>/`. Commit or merge manual files to the repository's default branch, then refresh ContextOps.

`README.md` is treated as folder guidance and is not shown as a record. Invalid records do not block other valid records; ContextOps displays a warning with the file path and issue. Duplicate IDs are reported and only the first valid file is shown.

## Limits

- Only Markdown (`.md`) records are read.
- Files must be smaller than 1 MB.
- The library reads the connected repository's default branch; MCP searches the project's active approved commit snapshot.
- Draft proposals stay in Supabase and do not appear in the context library until a person approves them.
