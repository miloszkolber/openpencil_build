## ADDED Requirements

### Requirement: Verified bridge base image

The bridge image SHALL build from a linux/amd64 base digest resolved when the workflow prepares the build.

#### Scenario: Base image resolution

- **WHEN** the bridge workflow prepares a build
- **THEN** it resolves the `oven/bun` base tag to its linux/amd64 manifest digest
- **AND** the candidate build references that digest
- **AND** a missing or invalid digest fails the run instead of falling back to the mutable tag

#### Scenario: Base tag review

- **WHEN** Dependabot evaluates the repository
- **THEN** it proposes weekly bridge base-tag updates within the supported Bun major
- **AND** a Bun major upgrade remains a reviewed manual change
