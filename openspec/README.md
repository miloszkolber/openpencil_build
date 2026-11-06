# Documentation

This repository uses [OpenSpec](https://github.com/Fission-AI/OpenSpec) to keep implemented behavior, proposed changes and verification separate. Start with [project.md](project.md) for scope and ownership.

| Location | Maintained content |
| --- | --- |
| [specs/](specs/) | Implemented repository contracts, grouped by capability |
| [changes/](changes/) | Scoped work with intent, tasks and evidence |
| [backlog.md](backlog.md) | Deferred work, not implementation authorization |
| [maintenance-state.md](maintenance-state.md) | Scheduled dependency-review notes and source-review findings |
| [config.yaml](config.yaml) | Context and rules for OpenSpec artifact instructions |

## Capability map

| Capability | Implementation and commands | Verification owner |
| --- | --- | --- |
| [OpenPencil image](specs/cloud-image/spec.md) | [cloud/Dockerfile](../cloud/Dockerfile), [scripts/fetch_source.py](../scripts/fetch_source.py) | Cloud unit tests, smoke stack and image inspection |
| [Release pipeline](specs/release-pipeline/spec.md) | [.github/workflows/cloud.yml](../.github/workflows/cloud.yml), [scripts/resolve_release.py](../scripts/resolve_release.py), [scripts/publish.py](../scripts/publish.py) | Workflow runs, release policy tests and published manifests |
| [Deployment stack](specs/deployment/spec.md) | [deploy/](../deploy/), [cloud/configuration.md](../cloud/configuration.md) | Compose validation, local stack smoke run and configuration review |

Specs state the contract, not a claim that every scenario has been executed. A build check does not establish upstream runtime compatibility or deployment acceptance.

## Working a change

1. Read the affected spec and implementation. Use memory as a lead, not proof.
2. For behavior changes, create `changes/<name>/proposal.md` with why, scope, affected capabilities and status. Add `specs/<capability>/spec.md` deltas.
3. Add technical design only for consequential choices. Track small, verifiable tasks in `tasks.md`.
4. Review scope before implementation. A proposal is not permission to deploy, restart services or change host state.
5. Verify implementation against scenarios. Record commands, results and gaps in `evidence.md`.
6. After verification and review, archive the change with OpenSpec. It merges completed deltas into main specs and moves the change under `changes/archive/YYYY-MM-DD-<name>/`.

Use `## Purpose`, `## Requirements`, `### Requirement: Name`, and `#### Scenario: Name` in main specs. Requirements use SHALL or MUST and describe observable outcomes. Scenarios use **WHEN** and **THEN**.

For acceptance-only or documentation-only work, use `skip_specs: true` in `.openspec.yaml` rather than inventing a behavior change. Never manufacture completed task or archive history.

## Tooling

`openspec/` is the real documentation and planning directory. Run from the repository root:

```sh
python3 -m unittest discover -s tests
bun scripts/check-docs.mjs
bun test scripts/check-docs.test.mjs
OPENSPEC_TELEMETRY=0 bun x --bun @fission-ai/openspec@1.16.0 validate --all --strict
```

Use `--skip-specs` only for changes with no deltas or deltas already merged and reviewed. Never use `--no-validate` to hide an archive failure.
