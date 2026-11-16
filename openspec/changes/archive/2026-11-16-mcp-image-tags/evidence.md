# Evidence

## Publisher

- `python3 -m unittest tests.test_publish_mcp`: 5 tests passed, covering absent, equal, descendant and unrelated revisions, and `git merge-base --is-ancestor` in a temporary repository.
- Against the live registry on 2026-11-16, `scripts/publish_mcp.py --check` read `latest` revision `16fd21785dc42aae25532858e6c29aca992b6f7c` and reported:
  - `d738939d…` (current `main`) moves the aliases, "candidate descends from the published revision";
  - `16fd21785dc4…` moves them, "same revision";
  - `0cb5668f…` (older) keeps them, "candidate is not a descendant of the published revision".

## Workflow

- `scripts/publish_mcp.py`, `tests/test_publish_mcp.py` and the workflow are in the push and pull-request path filters.
- The workflow checks out full history, publishes through the script, and pulls the commit tag plus the aliases when they moved.
- The built image now states `org.opencontainers.image.version=0.1.0` and `org.opencontainers.image.licenses=MIT` instead of inheriting the Bun base image's version label.
- `rhysd/actionlint:1.7.12` reported no findings for the edited workflow.

## Repository checks

- `python3 -m unittest discover -s tests`: passed, including the new module.
- `bun scripts/check-docs.mjs` and `bun test scripts/check-docs.test.mjs`: no failures.
- `@fission-ai/openspec@1.16.0 validate --all --strict`: passed with the change delta.

## After merge

Recorded in the maintenance state: the run for the merge commit, the `sha-` tag it published and whether the aliases moved.
