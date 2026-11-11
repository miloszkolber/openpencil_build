## ADDED Requirements

### Requirement: Automatic Cloud session recovery

The bridge SHALL support optional unattended Cloud session recovery using a separately provisioned account without replaying document mutations.

#### Scenario: Session expires

- **WHEN** a Cloud session expires or is revoked and valid service-account credentials are configured
- **THEN** the bridge signs in through the Cloud API and securely stores the replacement token
- **AND** subsequent API calls use the replacement without restarting open rooms

#### Scenario: Sign-in cannot complete

- **WHEN** Cloud is unavailable, credentials are rejected, or additional authentication is required
- **THEN** the bridge reports a failure without logging credentials or replacing a valid token with an invalid one
- **AND** it does not replay an uncertain document mutation
