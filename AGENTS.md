# Working on the KAI site

The source entry point `index.html` requires HTTP access to `src/`, `data/`, and `styles.css`. Do not present it alone as a working in-chat preview.

After changes to application code, styles, or initial data:

1. Run the checks appropriate to the changes.
2. Run `npm run preview:build` to refresh `/workspace/artifacts/index.html`.
3. Verify that the generated HTML opens with external requests blocked, renders the overview, and applies the selected theme colors.
4. Link `/workspace/artifacts/index.html` as **Актуальний локальний перегляд**. Use this single canonical output; do not create dated or theme-specific preview copies.

The generated preview embeds the initial analytics data, CMS pages, styles, code, and XLSX library. Existing in-chat snapshots do not necessarily refresh when workspace files or GitHub change. Do not claim that an already open snapshot was updated without verifying it.

The site and preview store edits in browser-local storage. Preserve user changes; do not clear storage or overwrite a backup during verification. Use an isolated browser context for checks.
