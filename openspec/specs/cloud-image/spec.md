# Cloud image

## Purpose

Build the OpenPencil Cloud image from the newest upstream mainline release source with refreshed dependencies and verified runtime behavior.

Source: [Dockerfile](../../../cloud/Dockerfile), [release resolver](../../../scripts/resolve_release.py), [source fetcher](../../../scripts/fetch_source.py), [base resolver](../../../scripts/bases.py). Checks: Cloud unit tests and the [smoke stack](../../../cloud/smoke.sh).

## Requirements

### Requirement: Resolved release source

The image SHALL be built from the source archive of the newest non-draft OpenPencil mainline release commit, including prereleases.

#### Scenario: Automatic selection

- **WHEN** the resolver runs without an override
- **THEN** it selects the highest semver release tag across stable and prerelease releases
- **AND** it records the release tag, version, release ID and full commit

#### Scenario: Manual override

- **WHEN** a manual run supplies a release tag
- **THEN** the resolver accepts only an existing non-draft OpenPencil release
- **AND** an unknown or malformed tag fails the run
- **AND** an older release can be built without moving channel tags for a newer release

#### Scenario: Source identity

- **WHEN** the source archive is extracted
- **THEN** its `package.json` version matches the resolved release version
- **AND** unsafe archive paths or links fail extraction

### Requirement: Dependency and base refresh

The build SHALL refresh runtime dependencies within the release's declared ranges and resolve base images to linux/amd64 digests.

#### Scenario: Runtime dependencies

- **WHEN** the image is built
- **THEN** `bun update` runs before the package and server builds
- **AND** the Cloud unit tests run after the update
- **AND** a dependency resolution or unit-test failure stops the build

#### Scenario: Base images

- **WHEN** the workflow prepares a build
- **THEN** it resolves every external `FROM` image to its linux/amd64 manifest digest
- **AND** the Dockerfile used for the build references those digests
- **AND** a missing or invalid digest fails the run instead of falling back to a mutable tag

#### Scenario: Dependency monitoring

- **WHEN** Dependabot evaluates the repository
- **THEN** it proposes weekly GitHub Actions and Docker base-tag updates

### Requirement: Pre-publication verification

A candidate image SHALL pass unit tests and a real service smoke test before publication.

#### Scenario: Smoke stack

- **WHEN** a candidate image is built
- **THEN** PostgreSQL, SeaweedFS, the bucket initializer and the candidate start together
- **AND** `/health` reports `ok`
- **AND** `/ready` reports `ready`
- **AND** `/welcome` serves an HTML page
- **AND** a failed check leaves the published tags unchanged

### Requirement: Publication identity

Publication SHALL identify the image with its upstream release and build inputs.

#### Scenario: Version and channel tags

- **WHEN** a checked candidate is published
- **THEN** the exact release version is written as a tag
- **AND** `latest` is written only for the newest stable release
- **AND** `next` is written only for the newest prerelease
- **AND** a manual build of an older release never moves `latest` backwards

#### Scenario: Provenance labels

- **WHEN** the published image is inspected
- **THEN** `org.opencontainers.image.version` matches the release version
- **AND** `io.openpencil-build.upstream.commit` matches the resolved commit
- **AND** `io.openpencil-build.inputs` matches the build fingerprint
- **AND** the manifest digest identifies the published bytes

### Requirement: Runtime image boundary

The image SHALL contain only the built Cloud server, its site assets and upstream license notices on a non-root Node runtime.

#### Scenario: Runtime contents

- **WHEN** the runtime image is inspected
- **THEN** it runs as the unprivileged `node` user
- **AND** it serves on port 8787
- **AND** it contains the standalone server, the built site, the Cloud LICENSE and the Cloud NOTICE
- **AND** it contains no package manager
