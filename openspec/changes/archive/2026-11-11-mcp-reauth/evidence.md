# Evidence

- Candidate image built and passed authentication, Cloud and live-document unit tests. Tests include replacement token use, concurrent checks, private credential mode and plaintext transport refusal.
- A disposable revoked session was replaced automatically against Cloud. The replacement had editor access.
- A second disposable Cloud document remained open while its service-account session was revoked. The bridge reauthenticated, created a shape and saved a revision. The document was deleted afterward.
- A dedicated non-administrator account was created through the email verification and workspace invitation flow. Its workspace role is editor. Enrollment and sign-up were restored to closed immediately after registration.
- Python unit tests, documentation checks and tests, strict OpenSpec validation and actionlint passed. The checked image was deployed and its readiness endpoint and workspace access passed. Its production service session was revoked and the bridge automatically replaced it and regained editor access without a restart.
- Browser acceptance, natural expiration and unattended recovery across a long outage are not established by these checks.
