# Automatic MCP Cloud reauthentication

## Why

A Cloud session cannot recover after expiry or revocation. The bridge currently holds its startup token for its entire process lifetime.

## Scope

Add optional dedicated-account credentials, replace expired Cloud sessions without restarting open rooms, and preserve manual device login when credentials are absent. The Cloud MCP capability is affected. The operator authorized a dedicated account and temporary enrollment changes for host provisioning.

## Status

In progress. No authentication-policy bypass or automatic retry of document writes is authorized.
