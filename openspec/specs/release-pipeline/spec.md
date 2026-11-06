# Release pipeline

## Purpose

Run the weekly release build, serialize publication and publish only a checked candidate from the default branch.

Source: [workflow](../../../.github/workflows/cloud.yml), [release resolver](../../../scripts/resolve_release.py), [publisher](../../../scripts/publish.py), [Dependabot](../../../.github/dependabot.yml). Checks: Python policy tests, release discovery, smoke stack and published-manifest inspection.

## Requirements

### Requirement: Scoped workflow triggers

The workflow SHALL run on a weekly schedule, relevant repository changes, pull requests and manual dispatch.

#### Scenario: Scheduled run

- **WHEN** the Monday 04:47 UTC schedule runs
- **THEN** the workflow resolves the newest mainline OpenPencil release
- **AND** it builds from that release's source archive with refreshed dependencies and bases

#### Scenario: Relevant changes and pull requests

- **WHEN** a push to `main` or a pull request changes the image build, scripts, tests or workflow
- **THEN** the workflow builds and smoke-tests a candidate
- **AND** a pull request does not log in to the registry or publish

#### Scenario: Manual dispatch

- **WHEN** a manual run supplies a release tag
- **THEN** the workflow builds that release
- **AND** publication of an older release is limited to its exact version tag

### Requirement: Serialized publication

Publication SHALL be serialized per ref and SHALL push only the checked candidate from `main`.

#### Scenario: Publication sequence

- **WHEN** a non-PR default-branch run has a checked candidate
- **THEN** it logs in to GHCR and publishes the exact version tag
- **AND** it verifies the published manifest digest and provenance labels
- **AND** it publishes channel tags only when the release qualifies
- **AND** a concurrent run cannot interleave the same publication

#### Scenario: Latest rollback guard

- **WHEN** the candidate qualifies for `latest`
- **THEN** the publisher reads the existing `latest` version
- **AND** it refuses to replace a newer published version with an older candidate

### Requirement: Package accessibility

The published package SHALL be pullable without registry authentication.

#### Scenario: Anonymous pull

- **WHEN** a version is published
- **THEN** the workflow logs out of GHCR and pulls that exact version anonymously
- **AND** a private or otherwise inaccessible package fails the run with a visibility instruction
- **AND** the build does not claim successful publication when the anonymous pull fails

### Requirement: Evidence retention

A workflow run SHALL retain the resolved inputs and publication record.

#### Scenario: Run artifacts

- **WHEN** a run finishes, including a failed run
- **THEN** it uploads the resolved release, base digests, fingerprint and published tags when present
- **AND** artifacts contain no registry credentials or source archive

### Requirement: Documentation contracts

Documentation changes SHALL pass the local structural checker, its tests and the pinned OpenSpec validator.

#### Scenario: Reviewable failure

- **WHEN** a documentation change is pushed or proposed
- **THEN** links, spec structure and change metadata are checked
- **AND** missing scenarios or unimplemented claims fail instead of being accepted as complete
