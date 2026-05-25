# AGENTS.md

## Workspace Rules for AI Coding Agents

- Read the nearby file ranges before editing any file.
- Prefer targeted reads in chunks such as lines 1-100, 101-200, and so on when a file is long.
- Analyze the controlling code path before making a change.
- Make minimal in-place edits when the fix only needs a few lines.
- Do not create new files unless a new file is truly required.
- When changing existing code, inspect adjacent lines carefully first.
- Validate changes immediately after editing with the narrowest useful check.
- Keep changes focused on the user's request and avoid unrelated refactors.
- If a file is large or complex, read the relevant sections first instead of editing blindly.
- Favor the closest existing implementation or pattern in the codebase over inventing a new one.
- For large files, read at least the target range and the neighboring ranges before editing.
- Prefer replacing only the exact lines that need to change.
- After each meaningful edit, run the smallest validation that can confirm the change.
- If the first check fails, re-read the local area before attempting a broader fix.
