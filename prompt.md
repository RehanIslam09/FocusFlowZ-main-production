You are a senior frontend + systems engineer working on a production-grade knowledge system.

You are given an EXISTING CODEBASE.

---

# ⚠️ STEP 0 — CRITICAL (DO THIS FIRST)

Before writing ANY code:

1. Carefully read ALL provided files
2. DO NOT rewrite them
3. Copy their structure exactly
4. Extend them incrementally
5. Preserve ALL styles, UI, animations

If something is missing:

👉 ASK for the file instead of guessing

---

# 🚫 STRICT RULES

- DO NOT remove card customization system
- DO NOT break NotesPage UI
- DO NOT downgrade styling
- DO NOT use contenteditable=false hacks
- DO NOT replace TipTap
- ONLY extend existing system

---

# 🎯 OBJECTIVE

Transform this into a:

👉 FULL KNOWLEDGE HIVE SYSTEM (Obsidian + Notion hybrid)

---

# 🔴 FIRST — FIX CURRENT LINK SYSTEM (CRITICAL BUG)

Current issue:

Links render like:

<span contenteditable="false">[[note]]</span>

❌ This is WRONG
❌ Breaks cursor behavior
❌ Breaks editing

---

# ✅ REQUIRED FIX

You MUST:

👉 Implement a PROPER TipTap Mark Extension

---

# 🧠 1. INTERNAL LINK SYSTEM (CORRECT IMPLEMENTATION)

---

## Create:

InternalLinkExtension (TipTap Mark)

---

## Behavior:

- Acts like inline text
- Editable
- Cursor flows naturally
- No contenteditable=false

---

## Schema:

mark: internalLink

attrs:

- noteId (string)
- title (string)

---

## Rendering:

HTML:

<span class="ne-internal-link" data-id="...">Title</span>

---

## TipTap Commands:

- setInternalLink(noteId, title)
- unsetInternalLink()

---

## Parsing:

- Parse [[title]] input
- Convert to mark

---

## Suggestion Menu:

Trigger:

[[

---

### Requirements:

- Show dropdown
- Search notes
- Keyboard navigation
- Enter → insert link

---

## IMPORTANT:

Replace raw [[text]] with structured mark

---

# 🔁 2. LINK PARSER UPGRADE (VERY IMPORTANT)

---

## You already have extractWikiLinks

Improve it:

- ONLY rely on structured marks
- Raw [[text]] = fallback only

---

## Save format:

links: [noteId]

---

## Ensure:

- No duplicates
- Always synced with editor

---

# 🗄️ 3. SUPABASE (MANDATORY)

---

## Provide FULL SQL

---

### Update notes table:

ALTER TABLE user_notes
ADD COLUMN IF NOT EXISTS links TEXT[];

---

### Optional:

CREATE INDEX idx_notes_links ON user_notes USING GIN (links);

---

## Behavior:

- Update links on every save
- Keep existing schema intact

---

# 🔁 4. BACKLINK SYSTEM (PRODUCTION READY)

---

## Fix + Improve:

Your useBacklinks exists → upgrade it

---

## Requirements:

- Memoized
- Fast lookup
- Handles large datasets

---

## UI:

Editor:

"Linked References"

- Show backlinks
- Show outgoing links

---

## NotesPage:

Each card:

👉 show backlink count

DO NOT break card design
→ integrate into footer subtly

---

# 🌐 5. GRAPH DATA SYSTEM (PHASE 6 CORE)

---

## Build:

function buildGraph(notes)

Return:

{
nodes: [{ id, title }],
edges: [{ source, target }]
}

---

## Rules:

- No duplicate edges
- Ignore broken links

---

## Hook:

useGraphData()

- memoized
- efficient

---

## IMPORTANT:

DO NOT build UI yet
ONLY data layer

---

# 🧠 6. EDITOR INTELLIGENCE (HIGH QUALITY)

---

## Improve UX:

- Links highlighted properly
- Hover effect
- Click → navigate

---

## Fix Cursor Issues:

- No jump bugs
- No broken selection

---

## Add:

- unresolved links styling
- resolved links styling

---

# 🧱 7. BLOCK SYSTEM (LIGHT — DO NOT OVERBUILD)

---

## Add:

- block IDs to top-level nodes

---

## DO NOT:

- rebuild editor from scratch

---

## Optional:

- helper to traverse blocks

---

# 🎨 8. NOTES PAGE INTELLIGENCE

---

## KEEP:

Everything exactly as is

Your card system is already elite

---

## ADD:

### A. Backlink badge

🔗 3

---

### B. Related notes

Based on:

- shared links
- shared tags

---

## IMPORTANT:

- ZERO design downgrade
- integrate subtly

---

# ⚡ 9. PERFORMANCE

---

- Debounce link parsing
- Memoize graph + backlinks
- Avoid unnecessary renders

---

# 🧩 10. FILE STRUCTURE (IMPORTANT)

---

Extend existing files

Add if needed:

- InternalLinkExtension.js
- useGraphData.js
- linkUtils.js

---

## IF unsure:

ASK which files exist

---

# 🧠 OUTPUT REQUIREMENTS

---

Claude MUST:

1. Show modified code (not full rewrite)
2. Clearly indicate where to insert changes
3. Provide SQL separately
4. Ask for missing files if needed

---

# 🚀 FINAL GOAL

After implementation:

- Links behave perfectly
- Notes are interconnected
- Backlinks work instantly
- Graph data is ready
- UI remains premium

---

This system should feel like:

- Obsidian (linking)
- Notion (editing)
- Linear (polish)

---

# ⚠️ FINAL INSTRUCTION

DO NOT RUSH

Focus on:

1. Correct TipTap extension
2. Clean data flow
3. Stability over features

---
