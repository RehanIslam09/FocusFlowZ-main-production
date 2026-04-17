/**
 * src/lib/collectionTree.js
 *
 * Pure utility functions for working with the hierarchical
 * collections data structure.
 *
 * All functions are pure (no side effects), memoization-friendly.
 */

/* ─────────────────────────────────────────────────────────────
   buildCollectionTree
   ─────────────────────────────────────────────────────────────
   Converts a flat array of collections (each with optional
   parent_id) into a recursive tree.

   Returns TreeNode[]:
     {
       ...collection,        ← all original fields
       children: TreeNode[]  ← recursive children
     }
─────────────────────────────────────────────────────────────── */
export function buildCollectionTree(collections) {
  if (!collections?.length) return [];

  const map = new Map();
  collections.forEach((c) => map.set(c.id, { ...c, children: [] }));

  const roots = [];
  collections.forEach((c) => {
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id).children.push(map.get(c.id));
    } else {
      roots.push(map.get(c.id));
    }
  });

  // Sort each level alphabetically
  const sortLevel = (nodes) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((n) => sortLevel(n.children));
  };
  sortLevel(roots);

  return roots;
}

/* ─────────────────────────────────────────────────────────────
   buildCollectionsMap
   ─────────────────────────────────────────────────────────────
   Returns Map<id, collection> for O(1) lookups.
─────────────────────────────────────────────────────────────── */
export function buildCollectionsMap(collections) {
  const map = new Map();
  collections.forEach((c) => map.set(c.id, c));
  return map;
}

/* ─────────────────────────────────────────────────────────────
   getAncestorPath
   ─────────────────────────────────────────────────────────────
   Returns ordered array of collections from root → target.
   Used for breadcrumb rendering.

   Example: Math > Algebra > Linear Algebra
   → [mathCol, algebraCol, linearAlgebraCol]
─────────────────────────────────────────────────────────────── */
export function getAncestorPath(collectionId, collectionsMap) {
  if (!collectionId || !collectionsMap) return [];
  const path = [];
  let current = collectionsMap.get(collectionId);
  while (current) {
    path.unshift(current);
    current = current.parent_id ? collectionsMap.get(current.parent_id) : null;
  }
  return path;
}

/* ─────────────────────────────────────────────────────────────
   flattenTree
   ─────────────────────────────────────────────────────────────
   Returns all nodes in a tree as a flat array (DFS order).
   Useful for search, select dropdowns, etc.
─────────────────────────────────────────────────────────────── */
export function flattenTree(treeNodes, depth = 0) {
  const result = [];
  treeNodes.forEach((node) => {
    result.push({ ...node, depth });
    result.push(...flattenTree(node.children, depth + 1));
  });
  return result;
}

/* ─────────────────────────────────────────────────────────────
   getDescendantIds
   ─────────────────────────────────────────────────────────────
   Returns Set of all descendant collection IDs for a given
   collection ID. Used to count "all notes in subtree".
─────────────────────────────────────────────────────────────── */
export function getDescendantIds(collectionId, collectionsMap) {
  const result = new Set();
  const stack = [collectionId];
  while (stack.length) {
    const id = stack.pop();
    result.add(id);
    collectionsMap.forEach((col) => {
      if (col.parent_id === id) stack.push(col.id);
    });
  }
  return result;
}

/* ─────────────────────────────────────────────────────────────
   getDirectChildren
   ─────────────────────────────────────────────────────────────
   Returns collections whose parent_id === folderId.
   folderId = null → returns root-level collections.
─────────────────────────────────────────────────────────────── */
export function getDirectChildren(folderId, collections) {
  return collections
    .filter((c) => (c.parent_id ?? null) === (folderId ?? null))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ─────────────────────────────────────────────────────────────
   getDirectNotes
   ─────────────────────────────────────────────────────────────
   Returns notes directly inside a folder (not descendants).
   folderId = null → returns uncategorised notes.
─────────────────────────────────────────────────────────────── */
export function getDirectNotes(folderId, notes) {
  return notes.filter((n) => (n.collection_id ?? null) === (folderId ?? null));
}
