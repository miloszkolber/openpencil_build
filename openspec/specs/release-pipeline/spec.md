# Release pipeline

## Purpose

Check for a new upstream release daily, rebuild only when it is not already published, and publish a checked candidate from the default branch with `latest` tracking the newest mainline build.

Source: [workflow](../../../.github/workflows/cloud.yml), [release resolver](../../../scripts/resolve_release.py), [publisher](../../../scripts/publish.py), [Dependabot](../../../.github/dependabot.yml). Checks: Python policy tests, release discovery, smoke stack and published-manifest inspection.

## Requirements

### Requirement: Scoped workflow triggers

The workflow SHALL check for a new release daily and SHALL build on relevant repository changes, pull requests and manual dispatch.

#### Scenario: Daily release check

- **WHEN** the daily 04:17 UTC schedule runs
- **THEN** the workflow resolves the newest mainline OpenPencil release
- **AND** it checks whether that version and `latest` are already published
- **AND** it skips source download, build, smoke and publication when they match

#### Scenario: New release

- **WHEN** the scheduled release has no published version or `latest` does not point at it
- **THEN** the workflow builds from that release's source archive with refreshed dependencies and bases
- **AND** it publishes the version and `latest` after the checks pass

#### Scenario: Relevant changes and pull requests

- **WHEN** a push to `main` or a pull request changes the image build, scripts, tests or workflow
- **THEN** the workflow builds and smoke-tests a candidate even if the release is published
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
- **AND** it moves `latest` only when the candidate is the newest mainline release
- **AND** a concurrent run cannot interleave the same publication

#### Scenario: Latest rollback guard

- **WHEN** the candidate qualifies for `latest`
- **THEN** the publisher reads the existing `latest` version
- **AND** it refuses to replace a newer published version with an older candidate

### Requirement: Package identity

The image SHALL be published as `ghcr.io/miloszkolber/openpencil`.

#### Scenario: Package name

- **WHEN** the workflow publishes an image
- **THEN** the package path is `miloszkolber/openpencil`
- **AND** the source labels identify this build repository and the upstream release commit

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

- **WHEN** a run finishes, including a failed or skipped build
- **THEN** it uploads the resolved release, base digests, fingerprint and published tags when present
- **AND** artifacts contain no registry credentials or source archive

### Requirement: Documentation contracts

Documentation changes SHALL pass the local structural checker, its tests and the pinned OpenSpec validator.

#### Scenario: Reviewable failure

- **WHEN** a documentation change is pushed or proposed
- **THEN** links, spec structure and change metadata are checked
- **AND** missing scenarios or unimplemented claims fail instead of being accepted as complete
