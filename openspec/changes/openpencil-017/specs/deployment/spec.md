## MODIFIED Requirements

### Requirement: Configuration reference

The repository SHALL document the image's startup variables, secrets and TOML sections.

#### Scenario: Operator lookup

- **WHEN** an operator reads `cloud/configuration.md`
- **THEN** it lists `OPENPENCIL_CLOUD_CONFIG`, `OPENPENCIL_CLOUD_SITE_DIR`, `PORT`, `HOST` and the AI services variables `OPENPENCIL_SERVICES_CONFIG`, `OPENPENCIL_SERVICES_UPSTREAM_KEY` and `DATABASE_URL`
- **AND** it lists each default secret variable, including `OPENPENCIL_CLOUD_SERVICES_SIGNING_KEY` and `GITHUB_CLIENT_SECRET`, and the TOML section that consumes it
- **AND** it describes local, private-team and public-service deployment profiles
- **AND** it records the distroless runtime constraint that only `/tmp` is writable
