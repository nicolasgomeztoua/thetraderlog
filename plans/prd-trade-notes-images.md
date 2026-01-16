# PRD: Trade Notes Image Support

## Overview

Add drag-and-drop and paste image support to Trade Notes and DailyJournalPreview, reusing the existing S3 infrastructure. Images are embedded inline in HTML content (no separate attachment tracking).

## Goals

- Enable image paste/drop in Trade Notes tab
- Enable image paste/drop in DailyJournalPreview (trade detail context)
- Reuse existing S3 utilities and Daily Journal patterns
- Keep implementation minimal (no toolbar, no attachment records)

## User Stories

### US-000: Audit Existing Image Upload Infrastructure

**Description**: As a developer, I want to audit existing image upload code so that we reuse utilities and avoid duplication.

**Acceptance Criteria**:
- [ ] Confirm S3 utilities exist in `src/lib/storage/s3.ts`
- [ ] Confirm `handleImageUpload` pattern in `journal-editor.tsx` (lines 156-232)
- [ ] Confirm `handleImageInsert` pattern with blob preview (lines 235-296)
- [ ] Confirm `handlePaste` and `handleDrop` event handlers (lines 299-354)
- [ ] Document findings in `scripts/ralph/progress.txt`
- [ ] Typecheck passes (`bun run check`)

**Search Commands**:
```bash
grep -rn "getPresignedUploadUrl\|presignedUrl" src/lib/storage/
grep -rn "handleImageUpload\|handleImageInsert" src/components/daily-journal/
```

---

### US-001: Create Generic Image Upload tRPC Endpoint

**Description**: As a developer, I want a generic image upload endpoint so that both trade notes and journal preview can upload images without creating attachment records.

**Acceptance Criteria**:
- [ ] Create `storage` router at `src/server/api/routers/storage.ts`
- [ ] Add `getImageUploadUrl` mutation accepting `filename`, `mimeType`, `size`, `context` (e.g., "trade-notes", "journal")
- [ ] Key format: `images/{userId}/{context}/{uuid}-{filename}`
- [ ] Returns `{ presignedUrl, publicUrl }` (publicUrl for embedding in HTML)
- [ ] Uses existing S3 utilities from `src/lib/storage/s3.ts`
- [ ] Uses `protectedProcedure` for auth
- [ ] Router registered in `src/server/api/root.ts`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-002: Create useImageUpload Hook

**Description**: As a developer, I want a reusable hook for image uploads so that any Tiptap editor can support paste/drop images.

**Acceptance Criteria**:
- [ ] Create `src/hooks/use-image-upload.ts`
- [ ] Hook accepts `context: string` parameter (for S3 key organization)
- [ ] Exports `uploadImage(file: File): Promise<string | null>` - returns public URL
- [ ] Uses `storage.getImageUploadUrl` mutation
- [ ] Uploads via XMLHttpRequest with progress tracking
- [ ] Shows toast notifications (uploading %, success, error)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-003: Create useTiptapImageHandlers Hook

**Description**: As a developer, I want a hook that provides paste/drop handlers for Tiptap editors so that image handling is consistent across editors.

**Acceptance Criteria**:
- [ ] Create `src/hooks/use-tiptap-image-handlers.ts`
- [ ] Hook accepts `editor: Editor | null`, `uploadImage: (file: File) => Promise<string | null>`
- [ ] Implements `handleImageInsert` with instant blob preview pattern (from journal-editor)
- [ ] Implements `handlePaste` for clipboard images
- [ ] Implements `handleDrop` for dropped files
- [ ] Attaches/detaches event listeners to editor DOM
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-004: Create TradeNoteEditor Component

**Description**: As a trader, I want a minimal rich text editor for trade notes so that I can paste/drop images into my notes.

**Acceptance Criteria**:
- [ ] Create `src/components/trade-detail/trade-note-editor.tsx`
- [ ] Minimal Tiptap: StarterKit + Image + Link + Placeholder (no toolbar)
- [ ] Placeholder text: "Add notes about this trade... (paste images with Ctrl+V)"
- [ ] Auto-save on blur or after 500ms debounce (same as EditableTextarea behavior)
- [ ] Uses `useImageUpload` hook with context "trade-notes"
- [ ] Uses `useTiptapImageHandlers` hook for paste/drop
- [ ] Props: `value: string | null`, `onChange: (value: string | null) => void`, `tradeId: string`
- [ ] Terminal design system styling (matches existing editors)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-005: Replace EditableTextarea with TradeNoteEditor

**Description**: As a trader, I want the Trade Note tab to use the new editor so that I can add images to my notes.

**Acceptance Criteria**:
- [ ] Update `src/components/trade-detail/content-panel.tsx`
- [ ] Replace `EditableTextarea` in NotesSection with `TradeNoteEditor`
- [ ] Pass `trade.notes`, `onUpdateField`, and `trade.id` as props
- [ ] Existing plain text notes render correctly in Tiptap (auto-wrapped in `<p>`)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: paste image works, drop image works

---

### US-006: Add Image Handlers to DailyJournalPreview

**Description**: As a trader, I want to paste/drop images in the Daily Journal preview (trade detail) so that I can quickly add screenshots.

**Acceptance Criteria**:
- [ ] Update `src/components/daily-journal/daily-journal-preview.tsx`
- [ ] Add `useImageUpload` hook with context "journal"
- [ ] Add `useTiptapImageHandlers` hook for paste/drop
- [ ] Only enable image handling when `editable={true}`
- [ ] Uses existing `dailyJournal.getUploadUrl` + `confirmUpload` pattern (keeps attachment tracking for journal)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: paste image works in journal preview

---

### US-007: Integration Tests for Storage Router

**Description**: As a developer, I want integration tests for the storage router so that we verify upload URL generation works correctly.

**Acceptance Criteria**:
- [ ] Create `tests/integration/storage.test.ts`
- [ ] Tests `getImageUploadUrl` returns valid presigned URL structure
- [ ] Tests key format includes userId and context
- [ ] Tests rejects unauthenticated requests
- [ ] Tests validates file size limits (if any)
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

## Non-Goals (Out of Scope)

- Toolbar/formatting buttons for trade notes (minimal editor only)
- Attachment gallery/management for trade notes (inline only)
- Image editing/cropping
- Video uploads
- Slash commands in trade notes

## Technical Considerations

### Database
- No schema changes needed - `notes` field already accepts text (HTML is text)
- Existing plain text notes will render fine in Tiptap

### S3 Storage
- Reuse existing `src/lib/storage/s3.ts` utilities
- New key pattern for trade images: `images/{userId}/trade-notes/{uuid}-{filename}`
- Images are publicly accessible via presigned URLs (or public bucket config)

### Components to Create
- `src/server/api/routers/storage.ts` - Generic upload endpoint
- `src/hooks/use-image-upload.ts` - Reusable upload logic
- `src/hooks/use-tiptap-image-handlers.ts` - Paste/drop handlers
- `src/components/trade-detail/trade-note-editor.tsx` - Minimal Tiptap

### Components to Modify
- `src/components/trade-detail/content-panel.tsx` - Use new editor
- `src/components/daily-journal/daily-journal-preview.tsx` - Add image handlers
- `src/server/api/root.ts` - Register storage router

## Design Considerations

- Terminal design system: dark theme, monospace for status text
- Editor border: `border-white/10`, focus: `border-primary/50`
- Placeholder: `text-muted-foreground/50`
- Images: `max-w-full h-auto rounded my-2` (matches existing)

## Success Metrics

- Paste image in Trade Note → image appears inline
- Drop image file in Trade Note → image appears inline
- Paste image in Daily Journal Preview → image appears inline
- Existing plain text notes display correctly after migration
- No new attachment tables needed

## Open Questions

None - scope is well-defined.
