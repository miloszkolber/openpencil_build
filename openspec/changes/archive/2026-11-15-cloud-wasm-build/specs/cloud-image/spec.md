## ADDED Requirements

### Requirement: Release-defined WebAssembly build

The Cloud image build SHALL compile required WebAssembly from the resolved release source using its declared Rust toolchain.

#### Scenario: Release requires the HTML engine

- **WHEN** the release contains the HTML engine's Rust toolchain and source
- **THEN** the build provides Cargo and the declared WebAssembly target to the package build
- **AND** the generated module is available to the upstream package and Cloud builds
- **AND** the final runtime does not include the Rust toolchain
