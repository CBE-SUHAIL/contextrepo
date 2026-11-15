# Proposal drafts

Proposal drafts are saved in Supabase PostgreSQL and do not appear in the approved GitHub context library. A person can submit a draft in ContextOps or an AI assistant can use a type-specific MCP tool to submit one. Only the signed-in person can approve or reject a proposal.

## Enable draft saving in Supabase

For a new Supabase database, apply migrations `003`, `004`, `005`, and `006` in order. If the proposal and review workflow is already set up, apply only `006_typed_proposal_content.sql` now.

1. Open the Supabase project and go to **SQL Editor**.
2. Open `apps/api/database/migrations/003_context_proposal_drafts.sql` in this repository.
3. Copy the complete SQL into the Supabase editor and run it once.
4. For the initial setup, apply `004_proposal_review_mcp.sql`, then `005_active_context_release.sql` and `006_typed_proposal_content.sql`; restart the API and web app.

Do not rerun migrations `001` or `002`. Migration `003` creates the proposal table. Migration `004` adds review states/publication details and MCP keys. Migration `005` adds the pinned approved-context release. Migration `006` adds type-specific draft content while keeping existing draft columns readable.

## Enable review and MCP

1. In Supabase **SQL Editor**, apply any missing migrations in order, including `apps/api/database/migrations/006_typed_proposal_content.sql`.
2. Restart the API and web app after the migration is complete.
3. Open **Proposals**, select a draft, review it, and choose **Approve & publish** or **Reject**.
4. Approval validates required information and writes a Markdown record under `context/<type>/` on the connected GitHub repository's default branch. The page displays the result and GitHub commit path.
5. Open **Settings**, create an MCP access key, and follow [`mcp-proposals.md`](mcp-proposals.md) to connect an MCP client. The key is shown only once.

## Proposal types

The form now shows fields that fit the selected proposal type. See the [proposal type contract](proposal-type-contract.md) for the field definitions. Drafts remain separate from approved context until a person approves them.

## Use the current form

1. Open **Proposals** in ContextOps and choose **New draft**.
2. Enter a title and choose one of the seven context types.
3. Fill in the fields shown for that type. Items in list fields go one per line. Leave details blank when they are unknown; a draft can be saved before it is complete.
4. Choose **Save draft**. The editor closes and the refreshed draft list shows the saved item.
5. Select it later to edit. Choosing **Save changes** closes the editor and refreshes the list again.

The title is required to save a draft. The approval requirements depend on the selected type. For example, a Decision needs an outcome; an Open Question does not. A Research record needs at least one source reference.

## Verify the phase manually

- Create a draft, refresh the page, and confirm it is still listed.
- Reopen it, change its title or reasoning, save, and confirm the update appears.
- Open the Context library and confirm the draft does not appear there.
- Try each type and confirm the form shows its matching fields. Save an incomplete draft, reopen it, and confirm the entered values remain.
- Confirm an Open Question can be approved without an answer, while a Decision missing its outcome is blocked with a clear message.
- Approve a complete example and check that the GitHub Markdown has `schemaVersion: 2`, the common YAML fields, and only the selected type's content fields. Confirm it appears in Context library.
- Confirm older approved context files still appear in Context library.
- Create a second draft and reject it. Confirm it shows as rejected and does not appear in Context library or GitHub.
- Try approving a draft with missing question, outcome, or rationale; confirm the API blocks it.
- In Settings, create an MCP key and confirm it is shown once; revoke it and confirm the old key no longer authenticates.
- Connect an MCP client to `/api/mcp`, confirm the seven type-specific submit tools are listed, submit a proposal, and confirm it appears as a draft. Verify the MCP tools offer no approval or publish action.

## Data and security

- Each draft belongs to the signed-in user and their connected project.
- The API checks the ContextOps session and scopes reads and edits to that user and project.
- Create and edit requests are checked against the configured ContextOps web origin.
- Draft status is set by the API. The MCP tool cannot set review status.
- MCP access keys are random, user-scoped, revocable, and stored as SHA-256 hashes. GitHub installation tokens and ContextOps browser sessions are not used by MCP clients.
- Approval runs required-field checks and warns about a likely conflict with an approved record before the user confirms.
- GitHub access failure prevents the proposal being marked approved. Rejected and draft records remain out of the GitHub context library.
