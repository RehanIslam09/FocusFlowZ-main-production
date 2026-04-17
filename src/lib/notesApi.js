/**
 * src/lib/notesApi.js
 *
 * Shared API helpers for notes + collections.
 * Updated to support hierarchical collections (parent_id).
 */

/* ─────────────────────────────────────────────────────────────
   createNote
─────────────────────────────────────────────────────────────── */
export async function createNote(
  supabase,
  { title, collection_id, subject, tags, content },
  userId,
) {
  const { data, error } = await supabase
    .from('user_notes')
    .insert({
      user_id: userId,
      title: title || 'Untitled',
      subject: subject || null,
      collection_id: collection_id || null,
      tags: tags || [],
      content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/* ─────────────────────────────────────────────────────────────
   createCollection
   Now accepts optional parent_id for nested folders.
─────────────────────────────────────────────────────────────── */
export async function createCollection(
  supabase,
  { name, icon, color, parent_id },
  userId,
) {
  const { data, error } = await supabase
    .from('note_collections')
    .insert({
      user_id: userId,
      name,
      icon: icon || '📁',
      color: color || '#c4913a',
      parent_id: parent_id || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/* ─────────────────────────────────────────────────────────────
   deleteNote
─────────────────────────────────────────────────────────────── */
export async function deleteNote(supabase, noteId) {
  const { error } = await supabase.from('user_notes').delete().eq('id', noteId);
  if (error) throw new Error(error.message);
}

/* ─────────────────────────────────────────────────────────────
   deleteCollection
   Child collections cascade via DB (ON DELETE CASCADE).
   Notes are set to collection_id = null via app logic before deletion
   (or you can add a DB trigger to nullify them).
─────────────────────────────────────────────────────────────── */
export async function deleteCollection(supabase, collectionId) {
  const { error } = await supabase
    .from('note_collections')
    .delete()
    .eq('id', collectionId);
  if (error) throw new Error(error.message);
}
