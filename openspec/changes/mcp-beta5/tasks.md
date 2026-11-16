# Tasks

- [x] 1.1 Bump the pinned `@open-pencil` packages to `0.17.0-beta.5` and refresh `bun.lock`; verified by an image build whose installed package versions read `0.17.0-beta.5`.
- [x] 1.2 Replace `vendor/collab/` with the beta.5 source and update `vendor/NOTICE.md`; verified by a file-by-file diff against the release tag that reports no differences.
- [x] 1.3 Replace the removed `initCanvasKit` import with `getCanvasKit`, and hide the registry's app-only file tools so the bridge's `save_document` stays unique.
- [x] 1.4 Answer the registry's `close_document` command instead of beta.2's `close_file`.
- [x] 2.1 Run the bridge unit tests in the built image and the workflow's health and unauthorized checks; verified by the recorded command output.
- [x] 2.2 Exercise open, seeding, concurrent edits, save, stale-save conflict, external revision and restart recovery against a disposable beta.5 Cloud stack.
- [x] 2.3 Update the bridge README pin, the maintenance state and the change history; verified by the documentation checker and strict OpenSpec validation.
