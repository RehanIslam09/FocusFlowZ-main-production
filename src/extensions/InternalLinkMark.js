// src/extensions/InternalLinkMark.js
import { Mark, mergeAttributes } from '@tiptap/core';

/**
 * InternalLinkMark — TipTap Mark extension for [[note]] internal links.
 *
 * Why a Mark (not a Node):
 * - Marks are inline, cursor flows naturally through them
 * - No contenteditable=false hacks needed
 * - Coexists with bold, italic, fontFamily marks
 * - Undo/redo works natively
 * - Serialises cleanly into the JSONB content column
 *
 * Schema: { type: "internalLink", attrs: { noteId, title } }
 * Rendered HTML: <span class="ne-internal-link" data-note-id="..." data-title="...">Title</span>
 */
export const InternalLinkMark = Mark.create({
  name: 'internalLink',

  // Don't exclude other marks (bold+link coexist fine)
  excludes: '',
  spanning: false, // link marks should not auto-extend on typing past them

  addAttributes() {
    return {
      noteId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-note-id'),
        renderHTML: (attrs) =>
          attrs.noteId ? { 'data-note-id': attrs.noteId } : {},
      },
      title: {
        default: '',
        parseHTML: (el) =>
          el.getAttribute('data-title') || el.textContent || '',
        renderHTML: (attrs) =>
          attrs.title ? { 'data-title': attrs.title } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span.ne-internal-link[data-note-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'ne-internal-link' }),
      0, // 0 = hole: children (the visible text) go here
    ];
  },

  addCommands() {
    return {
      setInternalLink:
        (noteId, title) =>
        ({ commands }) =>
          commands.setMark(this.name, { noteId, title }),

      unsetInternalLink:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
