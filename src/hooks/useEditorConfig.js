/**
 * useEditorConfig.js
 *
 * // UPDATED — Mark-based FontFamily extension replaces node/attribute approach
 * // UPDATED — Clean extension list, no DOM hacks, no CSS variable overrides
 * // REMOVED — FontFamilyExtension (Extension.create with addGlobalAttributes)
 * // REMOVED — paragraph-level fontFamily attribute
 * // REMOVED — setFontFamily/unsetFontFamily as node commands
 */

import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { Mark, Node, mergeAttributes } from '@tiptap/core';
// ADD this import at the top, after the existing Mark/Node imports:
import { InternalLinkMark } from '../extensions/InternalLinkMark';

/* ─────────────────────────────────────────────────────────────
   // NEW — FontFamilyMark (Mark-based, inline, selection-aware)
   
   Design rationale:
   ─────────────────
   The previous implementation used Extension.create with addGlobalAttributes
   on paragraph/heading nodes. That is a BLOCK-LEVEL approach: the whole
   paragraph gets one font. It cannot express "two words with different fonts
   in the same paragraph", and it conflicts with how ProseMirror handles
   inline styling.

   A Mark is ProseMirror's native mechanism for inline spans. It:
   - Applies to exactly the selected text range (or to the insertion cursor
     for future typing, via storedMarks — same mechanism as bold/italic).
   - Serialises as { type: "fontFamily", attrs: { fontFamily: "..." } }
     inside TipTap JSON → round-trips through Supabase JSONB correctly.
   - Works with undo/redo out of the box.
   - Requires zero DOM manipulation.
───────────────────────────────────────────────────────────── */
export const FontFamilyMark = Mark.create({
  name: 'fontFamily',

  // Do not exclude other marks (bold, italic, etc. coexist freely)
  excludes: '',
  spanning: true,

  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (el) =>
          el.style.fontFamily || el.getAttribute('data-font-family') || null,
        renderHTML: (attrs) => {
          if (!attrs.fontFamily) return {};
          return {
            style: `font-family: ${attrs.fontFamily}`,
            'data-font-family': attrs.fontFamily,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      // Matches our own rendered spans
      { tag: 'span[data-font-family]' },
      // Matches pasted content with inline font-family CSS
      {
        style: 'font-family',
        getAttrs: (value) => ({ fontFamily: value }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      /**
       * setFontFamily(fontStack: string)
       *
       * Selection present → applies mark to the selected range.
       * Cursor only → sets a stored mark so the NEXT typed characters
       * inherit this font. Identical to how bold works.
       */
      setFontFamily:
        (fontFamily) =>
        ({ commands }) =>
          commands.setMark(this.name, { fontFamily }),

      /**
       * unsetFontFamily()
       *
       * Removes the mark from the selection, or clears the stored mark
       * at the cursor so typing reverts to the inherited font.
       */
      unsetFontFamily:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),

      /**
       * toggleFontFamily(fontStack: string)
       *
       * If the selection already has exactly this font → removes mark.
       * Otherwise → applies mark. Allows the toolbar button to reflect
       * "active" state correctly.
       */
      toggleFontFamily:
        (fontFamily) =>
        ({ commands, editor }) => {
          const isActive = editor.isActive('fontFamily', { fontFamily });
          return isActive
            ? commands.unsetMark(this.name)
            : commands.setMark(this.name, { fontFamily });
        },
    };
  },
});

/* ─────────────────────────────────────────────────────────────
   // UNCHANGED — CalloutExtension (block node, unaffected by font changes)
───────────────────────────────────────────────────────────── */
export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (el) => el.getAttribute('data-callout-type') || 'info',
        renderHTML: (attrs) => ({ 'data-callout-type': attrs.type }),
      },
      icon: {
        default: '💡',
        parseHTML: (el) => el.getAttribute('data-callout-icon') || '💡',
        renderHTML: (attrs) => ({ 'data-callout-icon': attrs.icon }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout-type]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'ne-callout' }), 0];
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attrs),
      toggleCallout:
        (attrs) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, attrs),
    };
  },
});

/* ─────────────────────────────────────────────────────────────
   // UPDATED — useEditorConfig hook
   // REMOVED — FontFamilyExtension (old node-attribute version)
   // NEW     — FontFamilyMark in extensions array
───────────────────────────────────────────────────────────── */
export default function useEditorConfig({
  initialContent,
  onUpdate,
  onSlashTrigger,
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: 'ne-codeblock' } },
        blockquote: {},
        bulletList: {},
        orderedList: {},
        horizontalRule: {},
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') return 'Heading…';
          return "Write something… or type '/' for commands";
        },
        includeChildren: true,
      }),
      CharacterCount,
      Link.configure({ openOnClick: false, autolink: true }),
      TaskList.configure({ HTMLAttributes: { class: 'ne-task-list' } }),
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      // // NEW — inline mark-based font, replaces the old Extension approach
      FontFamilyMark,
      CalloutExtension,
      InternalLinkMark,
    ],
    content: initialContent || {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    },
    autofocus: false,
    editorProps: {
      attributes: { class: 'ne-prosemirror', spellcheck: 'true' },
      handleKeyDown(view, event) {
        if (event.key === '/') {
          onSlashTrigger?.(view, event);
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onUpdate?.(ed.getJSON(), ed);
    },
  });

  const wordCount = editor?.storage?.characterCount?.words?.() ?? 0;
  const charCount = editor?.storage?.characterCount?.characters?.() ?? 0;

  return { editor, wordCount, charCount };
}
