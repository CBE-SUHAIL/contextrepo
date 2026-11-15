# Submit ContextOps drafts from an AI assistant

ContextOps exposes a Streamable HTTP MCP endpoint for creating proposal drafts and searching approved context.

- Endpoint: `http://localhost:4000/api/mcp` for local development.
- Tools: `search_approved_context` plus one draft tool for each context type: `submit_decision`, `submit_requirement`, `submit_constraint`, `submit_research`, `submit_rejected_approach`, `submit_open_question`, and `submit_project_state`.
- `search_approved_context` can filter by words and optional context type. It searches the active commit-pinned snapshot and returns its commit SHA and source file path.
- Each type-specific tool stores a draft in Supabase using fields designed for that kind of information. The older `submit_context_proposal` tool remains for compatibility. None of these tools can approve or publish context.
- Search returns only validated `approved` Markdown records. Drafts and rejected proposals are omitted.
- A person signs in to ContextOps, reviews the proposal on the Proposals page, then approves or rejects it.
- Approval writes a Markdown file with YAML front matter to the selected repository and default branch.

## Connect an AI assistant on Windows

1. Sign in to ContextOps and open **Settings** by clicking your account at the bottom of the sidebar.
2. Under **Connect an AI assistant**, choose **Create MCP key** and copy the key. ContextOps shows it only once; replace or revoke it from Settings if needed.
3. In Settings, select your assistant and follow the three on-screen steps. The first step saves the key as a Windows user environment variable. The agent setup command or config uses that variable, so the key is not written into your project files.
4. Restart the assistant and ask it to search ContextOps for an approved decision. Keep the ContextOps API running.

The current guide includes Codex, Claude Code, Cursor, and generic MCP apps. ChatGPT in a browser cannot connect to this local `localhost` endpoint; that requires a public HTTPS deployment and compatible sign-in.

For other MCP apps, use the Streamable HTTP endpoint `http://localhost:4000/api/mcp` and the header `Authorization: Bearer <your ContextOps key>`. Do not paste the key into a public repository, shared prompt, or screenshot. This local endpoint works only while the ContextOps API is running on the same machine/network; remote AI services need a securely reachable HTTPS deployment.

Each type-specific tool requires a title. Details may be omitted while drafting; ContextOps checks the selected type's required fields when a person tries to approve it. AI assistants should omit unknown details rather than invent them. It returns the saved draft ID and confirms that human review is required.

## Database

For a new database, apply migrations `003_context_proposal_drafts.sql`, `004_proposal_review_mcp.sql`, `005_active_context_release.sql`, and `006_typed_proposal_content.sql` in order. Existing installations should apply migration `006_typed_proposal_content.sql`. Migration 005 stores the active approved Git commit for each project; migration 006 adds type-specific proposal content. Do not put the raw MCP key in SQL or `.env`.
