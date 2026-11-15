# Proposal type contract

**Status:** Phase 1 design for type-specific proposals  
**Purpose:** Give teammates and AI assistants a clear structure for each kind of project knowledge.

## Core rule

Choose the type that matches what the information means. Do not make every record answer the same questions. A saved draft may be incomplete; a person reviews it before it is published to approved context.

AI assistants must use only information present in the conversation or referenced sources. They must not invent decisions, alternatives, owners, dates, evidence, or reasons. Leave unknown fields empty or omit them. An empty alternatives list means “none were captured in the material used for this draft”; it does not prove nobody considered any.

## Shared record details

Every record has a title and type. ContextOps manages its project, author, creation/update times, tags, source references, and review state. Type-specific information belongs in that type's content fields.

Keep review state separate from the meaning of the record:

- **Draft / approved / rejected** describes the ContextOps review and publishing workflow.
- A decision can still be **proposed** or **accepted** after a reviewer approves its record for publication.
- An approved Open Question remains open until the team resolves it.
- Project health (such as **on track** or **at risk**) is a project-state value, not a review state.

**Target draft behavior:** a draft can be saved with only a title and type. Before approval, the reviewer checks that the type-specific required information is present. This differs from the current MCP tool, which still requires the same question, summary, and rationale fields for every type; a later implementation phase will align it with this contract.

## Type-specific fields

| Type                  | Fields to capture                                                                                                                                         | Minimum information before approval                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decision**          | Problem/context; decision drivers; outcome; rationale; considered options and trade-offs; consequences; revisit condition, if useful                      | The problem, the actual chosen outcome, and why it was chosen. If no outcome was chosen, use **Open question**.                                             |
| **Requirement**       | One requirement statement; rationale; source or originating need, if known; acceptance/verification criteria; owner or priority, if known                 | A clear, testable statement and a way to check whether it is met. NASA guidance supports recording rationale, source traceability, and verification method. |
| **Constraint**        | The boundary (“must” / “must not”); scope; source or who imposed it; rationale; impact; how compliance is checked, if applicable                          | A specific boundary and what part of the project it applies to. Do not turn a preference into a constraint.                                                 |
| **Research**          | Research question; scope; method or how information was gathered; findings with sources/evidence; confidence; limitations; implications or recommendation | A question, evidence-backed findings, and their sources. Label a recommendation as a recommendation, not a team decision.                                   |
| **Rejected approach** | Approach considered; reason it was rejected; evidence or trade-off; chosen alternative, if known; condition for reconsideration, if useful                | The approach and the team's recorded reason for rejecting it. Do not infer the chosen alternative.                                                          |
| **Open question**     | Unresolved question; why it matters; known facts; missing information; options actually discussed; possible next step / owner / target date, if known     | The unresolved question and its relevance. An answer is not required.                                                                                       |
| **Project state**     | As-of time; overall health; short summary; completed work; current work; blockers/risks; next steps; decisions needed                                     | The update date, current health, and a concise factual status. Treat it as time-sensitive; a later update may replace it.                                   |

For every type, include source references when available. Do not require alternatives or discussion notes where they do not apply. Use one record for one main item of knowledge; link related records instead of combining unrelated facts.

## Example fit check: database discussion

Known from the current ContextOps example: a search found `context/database.md`, which labels the PostgreSQL record as a test sample and says the WorkforceIntelligence team did not select PostgreSQL. The saved draft did not establish any alternatives to record.

This belongs under **Open question**, not **Decision**:

This is a documentation-only example for designing the form. It is not an approved WorkforceIntelligence record and will not be added to that repository's context folder.

```yaml
title: Database choice remains open
type: open-question
content:
  question: Which database should the team use?
  whyItMatters: AI assistants need an approved answer before they can reliably use the team's database choice.
  knownFacts:
    - The approved PostgreSQL record is explicitly a test sample, not a team decision.
  unknowns:
    - The database the team will choose.
  alternativesConsidered: []
  sourceReferences:
    - context/database.md
```

The empty alternatives list records only that this draft has no alternatives to include. It does not claim that the team never discussed any. A Decision record would be inappropriate until there is a real outcome to record.

## Phase 1 review checklist

- [ ] Each type has a distinct purpose and its own fields.
- [ ] Every type can be saved as a draft without making up missing facts.
- [ ] Each type has a clear minimum for human approval.
- [ ] Approval state is distinct from the facts or status described by a record.
- [ ] The database example is an Open Question and does not claim PostgreSQL or another database was selected.

## Implementation note

This is the content contract, not a database migration or final UI design. The next phase should choose a backward-compatible Supabase and GitHub Markdown/YAML representation for these fields, then update validation and readers to support existing records.

## References

- [MADR template](https://github.com/adr/madr/blob/develop/template/adr-template.md) — decision context, drivers, options, outcome, and consequences.
- [Rust RFC template](https://github.com/rust-lang/rfcs/blob/main/0000-template.md) — proposal rationale, alternatives, drawbacks, and unresolved questions.
- [NASA Systems Engineering Handbook](https://science.nasa.gov/wp-content/uploads/2023/04/nasa_systems_engineering_handbook_0.pdf) — requirement rationale, source traceability, and verification.
- [NOAA evidence synthesis process](https://library.noaa.gov/evidencesynthesis/process) — transparent methods, evidence, limitations, and implications.
- [GitHub issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms) and [project updates](https://docs.github.com/en/issues/planning-and-tracking-with-projects/sharing-project-updates) — separate structured forms and dated status updates.
