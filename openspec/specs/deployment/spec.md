# Deployment stack

## Purpose

Provide a preconfigured one-machine Compose stack and a configuration reference for the published image.

Source: [deploy/compose.yaml](../../../deploy/compose.yaml), [deploy/openpencil.toml](../../../deploy/openpencil.toml), [deploy/.env.example](../../../deploy/.env.example), [configuration reference](../../../cloud/configuration.md). Checks: Compose configuration validation and the local stack smoke run.

## Requirements

### Requirement: Preconfigured dependencies

The deployment stack SHALL start OpenPencil with PostgreSQL, SeaweedFS, a bucket initializer and Mailpit.

#### Scenario: Compose services

- **WHEN** the stack starts from `deploy/compose.yaml`
- **THEN** PostgreSQL stores server data and SeaweedFS stores objects
- **AND** the bucket initializer creates the configured bucket before the server reports ready
- **AND** Mailpit receives transactional email and exposes a local inbox
- **AND** the server and object store share a network namespace so presigned URLs use `localhost:8333`

#### Scenario: Safe local defaults

- **WHEN** the example environment is used unchanged
- **THEN** published ports bind to loopback only
- **AND** the development storage credentials are identical in `.env.example` and `seaweedfs/s3.json`
- **AND** the README states that public deployment requires replacing every development credential and terminating TLS in front of the server and object store

### Requirement: Configuration reference

The repository SHALL document the image's startup variables, secrets and TOML sections.

#### Scenario: Operator lookup

- **WHEN** an operator reads `cloud/configuration.md`
- **THEN** it lists `OPENPENCIL_CLOUD_CONFIG`, `OPENPENCIL_CLOUD_SITE_DIR`, `PORT`, `HOST` and the AI relay variables
- **AND** it lists each default secret variable and the TOML section that consumes it
- **AND** it describes local, private-team and public-service deployment profiles
- **AND** it records the distroless runtime constraint that only `/tmp` is writable

### Requirement: First administrator path

The deployment documentation SHALL explain how the first account becomes a deployment administrator.

#### Scenario: Bootstrap

- **WHEN** the first account has enrolled
- **THEN** the README shows the operator command run from a matching source checkout
- **AND** it explains changing enrollment to `approval` or `closed` afterward
