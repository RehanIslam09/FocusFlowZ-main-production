/**
 * BlockMenu.jsx
 *
 * Hover action menu that appears on the left side of each block.
 * Shows a ⠿ drag handle and a ⋮ actions button.
 *
 * Implementation strategy:
 *  Since @tiptap/extension-drag-handle requires a commercial license,
 *  we implement a lightweight DOM-observer approach:
 *   1. A MutationObserver watches the ProseMirror element.
 *   2. On mouseover of any .ProseMirror > * block, we compute the
 *      block's bounding rect and position this floating menu.
 *   3. The actions button opens a tiny popover with:
 *        - Delete block
 *        - Duplicate block
 *        - Move up
 *        - Move down
 *
 * Props:
 *  editor   TipTap Editor instance
 *  wrapRef  React ref to the scroll wrapper (for offset calculation)
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  GripVertical,
  MoreVertical,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

const BlockMenu = memo(function BlockMenu({ editor, wrapRef }) {
  const [menuPos, setMenuPos] = useState(null); // { top, nodePos }
  const [popover, setPopover] = useState(false);
  const [hoverPos, setHoverPos] = useState(null); // ProseMirror node pos
  const popoverRef = useRef(null);
  const menuRef = useRef(null);

  /* ── Track hovered block ── */
  useEffect(() => {
    if (!editor || !wrapRef?.current) return;

    const pm = wrapRef.current.querySelector('.ProseMirror');
    if (!pm) return;

    const getNodePos = (el) => {
      try {
        const view = editor.view;
        const domPos = view.posAtDOM(el, 0);
        return domPos;
      } catch {
        return null;
      }
    };

    const handleMouseOver = (e) => {
      // Find immediate child of ProseMirror
      let target = e.target;
      while (target && target.parentElement !== pm) {
        target = target.parentElement;
      }
      if (!target || target === pm) {
        return;
      }

      const rect = target.getBoundingClientRect();
      const wrapRect = wrapRef.current.getBoundingClientRect();
      const pos = getNodePos(target);

      setMenuPos({
        top:
          rect.top -
          wrapRect.top +
          wrapRef.current.scrollTop +
          rect.height / 2 -
          12,
        nodePos: pos,
      });
      setHoverPos(pos);
    };

    const handleMouseLeave = (e) => {
      // Keep menu visible when moving to the menu itself
      if (menuRef.current?.contains(e.relatedTarget)) return;
      if (!popover) {
        setMenuPos(null);
        setHoverPos(null);
      }
    };

    pm.addEventListener('mouseover', handleMouseOver);
    pm.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      pm.removeEventListener('mouseover', handleMouseOver);
      pm.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [editor, wrapRef, popover]);

  /* ── Close popover on outside click ── */
  useEffect(() => {
    if (!popover) return;
    const handler = (e) => {
      if (!popoverRef.current?.contains(e.target)) {
        setPopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popover]);

  /* ── Block actions ── */
  const deleteBlock = useCallback(() => {
    if (hoverPos === null) return;
    const { state, dispatch } = editor.view;
    const $pos = state.doc.resolve(hoverPos);
    const node = $pos.nodeAfter || state.doc.nodeAt(hoverPos);
    if (!node) return;
    const from = hoverPos;
    const to = from + node.nodeSize;
    dispatch(state.tr.delete(from, to));
    setPopover(false);
    setMenuPos(null);
  }, [editor, hoverPos]);

  const duplicateBlock = useCallback(() => {
    if (hoverPos === null) return;
    const { state, dispatch } = editor.view;
    const $pos = state.doc.resolve(hoverPos);
    const node = $pos.nodeAfter || state.doc.nodeAt(hoverPos);
    if (!node) return;
    const insertPos = hoverPos + node.nodeSize;
    dispatch(state.tr.insert(insertPos, node));
    setPopover(false);
  }, [editor, hoverPos]);

  const moveBlock = useCallback(
    (dir) => {
      if (hoverPos === null) return;
      const { state, dispatch } = editor.view;
      const $pos = state.doc.resolve(hoverPos);
      const node = $pos.nodeAfter || state.doc.nodeAt(hoverPos);
      if (!node) return;
      const from = hoverPos;
      const to = from + node.nodeSize;

      if (dir === 'up') {
        // Find previous sibling
        const parent = $pos.parent;
        const parentStart = $pos.start();
        let prevStart = null,
          prevNode = null;
        let offset = 0;
        parent.forEach((child, childOffset) => {
          if (childOffset + parentStart === from) {
            // this is our node
            if (prevNode) {
              prevStart = parentStart + offset;
            }
          }
          prevNode = child;
          offset = childOffset;
        });
        if (prevStart === null) return;
        const tr = state.tr;
        tr.delete(from, to);
        tr.insert(prevStart, node);
        dispatch(tr);
      } else {
        // next sibling
        const nextStart = to;
        const nextNode = state.doc.nodeAt(nextStart);
        if (!nextNode) return;
        const tr = state.tr;
        tr.delete(from, to);
        tr.insert(from + nextNode.nodeSize, node);
        dispatch(tr);
      }
      setPopover(false);
    },
    [editor, hoverPos],
  );

  if (!menuPos) return null;

  return (
    <div
      ref={menuRef}
      className="ne-block-menu"
      style={{ top: menuPos.top }}
      onMouseLeave={() => {
        if (!popover) {
          setMenuPos(null);
          setHoverPos(null);
        }
      }}
    >
      {/* Drag handle (visual — actual DnD omitted without paid extension) */}
      <button className="ne-block-handle" title="Drag to reorder" type="button">
        <GripVertical size={13} />
      </button>

      {/* Actions trigger */}
      <div style={{ position: 'relative' }}>
        <button
          className={`ne-block-action-btn ${popover ? 'active' : ''}`}
          onClick={() => setPopover((p) => !p)}
          title="Block actions"
          type="button"
        >
          <MoreVertical size={13} />
        </button>

        {popover && (
          <div ref={popoverRef} className="ne-block-popover">
            <button
              className="ne-block-pop-item"
              onClick={() => moveBlock('up')}
              type="button"
            >
              <ArrowUp size={12} /> Move up
            </button>
            <button
              className="ne-block-pop-item"
              onClick={() => moveBlock('down')}
              type="button"
            >
              <ArrowDown size={12} /> Move down
            </button>
            <button
              className="ne-block-pop-item"
              onClick={duplicateBlock}
              type="button"
            >
              <Copy size={12} /> Duplicate
            </button>
            <div className="ne-block-pop-sep" />
            <button
              className="ne-block-pop-item danger"
              onClick={deleteBlock}
              type="button"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default BlockMenu;
