-- Store proposal details using fields that match the selected context type.
-- Existing generic columns remain in place for backward-compatible readers.
ALTER TABLE context_proposals
  ADD COLUMN IF NOT EXISTS content JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN context_proposals.content IS
  'Type-specific proposal content. The API falls back to legacy columns when this object is empty.';
