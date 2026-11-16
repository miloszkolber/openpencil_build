## ADDED Requirements

### Requirement: Published bridge image identity

The checked bridge image SHALL publish an immutable commit tag and SHALL move its aliases only forward.

#### Scenario: Immutable commit tag

- **WHEN** a checked bridge image from `main` is published
- **THEN** it is written as `sha-` followed by the first 12 characters of the commit
- **AND** the published tag carries the full commit in `org.opencontainers.image.revision`
- **AND** a tag that does not carry the expected commit fails the run

#### Scenario: Aliases advance

- **WHEN** no `latest` image is published, or the candidate commit equals or descends from the published `latest` revision
- **THEN** `latest` and `0.1.0` are written for the candidate
- **AND** the workflow pulls all published tags anonymously

#### Scenario: Older candidate

- **WHEN** the candidate commit is not a descendant of the published `latest` revision
- **THEN** `latest` and `0.1.0` keep their published digests
- **AND** the run reports why the aliases did not move
- **AND** the immutable commit tag is still written and verified
