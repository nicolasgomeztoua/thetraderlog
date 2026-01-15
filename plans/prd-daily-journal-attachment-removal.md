# PRD: Daily Journal Attachment Section Removal

## Overview

Remove the redundant attachment section from the Daily Journal page. The current implementation has a separate "Attachments" area with upload dropzone and gallery, but the editor already supports copy/paste and drag-and-drop for images directly. This creates UX friction around syncing images between the gallery and editor. Removing this section simplifies the interface and extends the editor to fill available space.

## Goals

- Simplify Daily Journal UI by removing redundant attachment management
- Extend editor to fill available vertical space
- Add `/image` slash command for discoverability of image upload
- Maintain all existing image insertion methods (toolbar, paste, drag-and-drop)

## User Stories

### US-001: Remove Attachment Section from Daily Journal Page

**Description**: As a trader, I want a cleaner journal interface without the separate attachment section so that I have more space for writing and a simpler experience.

**Acceptance Criteria**:
- [ ] Remove `AttachmentUpload` component from daily journal page (both mobile and desktop layouts)
- [ ] Remove `AttachmentGallery` component from daily journal page (both mobile and desktop layouts)
- [ ] Remove attachment-related imports from the page
- [ ] Remove `onAttachmentDeleted` callback and `editorRef` usage for gallery sync
- [ ] Existing attachments remain in database (no data deletion)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: attachment section no longer visible

### US-002: Extend Editor to Fill Available Space

**Description**: As a trader, I want the journal editor to use the full available height so that I have more writing space without scrolling.

**Acceptance Criteria**:
- [ ] Editor container uses flex-grow to fill remaining panel space
- [ ] Editor maintains proper padding and styling
- [ ] Works correctly in both mobile and desktop layouts
- [ ] Resizable panel behavior preserved on desktop
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: editor fills available vertical space in right panel

### US-003: Add Image Slash Command to Editor

**Description**: As a trader, I want to type `/image` in the editor to upload an image so that I can easily discover and use the image upload feature.

**Acceptance Criteria**:
- [ ] Add "Image" option to existing slash command menu
- [ ] Selecting `/image` triggers file picker dialog
- [ ] Selected image uploads and inserts at cursor position
- [ ] Uses existing `handleImageUpload` flow (blob preview → S3 upload → URL replacement)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: typing `/image` shows option, selecting it opens file picker

### US-004: Clean Up Unused Attachment Sync Code in Editor

**Description**: As a developer, I want to remove the unused `removeImageByUrl` method from the editor so that the codebase stays clean.

**Acceptance Criteria**:
- [ ] Remove `removeImageByUrl` method from `JournalEditor` component
- [ ] Remove related `useImperativeHandle` ref export if no longer needed
- [ ] Remove `onAttachmentDeleted` prop from editor interface
- [ ] Update any TypeScript interfaces/types accordingly
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

## Functional Requirements

1. **FR-001**: Editor must support all existing image insertion methods:
   - Toolbar image button (click to upload)
   - Copy/paste images from clipboard
   - Drag-and-drop image files into editor
   - NEW: `/image` slash command

2. **FR-002**: Editor must fill available vertical space in the journal panel using flexbox

3. **FR-003**: Existing attachment data in database must be preserved (no migration/deletion)

4. **FR-004**: Image deletion in editor works via keyboard (select image, press Delete/Backspace)

## Non-Goals (Out of Scope)

- Migrating or deleting existing attachment data from database
- Adding hover controls for image deletion in editor
- Image resizing or alignment controls
- Displaying legacy attachments in any form
- Changes to the AttachmentUpload or AttachmentGallery components themselves (they may be used elsewhere or kept for future use)

## Technical Considerations

### Files to Modify

| File | Changes |
|------|---------|
| `src/app/(protected)/daily-journal/page.tsx` | Remove attachment components, extend editor container |
| `src/components/daily-journal/journal-editor.tsx` | Remove `removeImageByUrl`, add slash command handler |
| `src/components/daily-journal/slash-command.tsx` | Add "Image" option to command list |

### Existing Image Upload Flow (Preserve)

```
1. User selects/pastes/drops image
2. Create blob URL → insert immediately for preview
3. Upload to S3 in background with progress
4. On success: replace blob URL with S3 URL
5. On failure: remove blob image, show error toast
6. Clean up blob URL
```

### Slash Command Integration

The editor already has a `SlashCommand` extension. Add an "Image" item that:
1. Opens native file picker via hidden input
2. Calls existing `handleImageUpload()` or `handleImageInsert()` function
3. Follows same upload flow as toolbar button

## Design Considerations

- Editor fills space naturally with `flex-grow: 1` and `flex: 1`
- Maintain existing padding/margins around editor
- No visual changes to editor styling itself
- Terminal design system compliance maintained

## Success Metrics

- Cleaner, simpler Daily Journal interface
- More vertical space available for writing
- Image insertion discoverable via `/image` slash command
- Zero regression in existing image upload functionality

## Open Questions

None - scope is well-defined based on user preferences.
