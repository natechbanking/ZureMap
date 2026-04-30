# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.3.x   | ✓         |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues by emailing **g.petrakis@natechbanking.com** with the subject line `[ZureMap] Security Vulnerability`.

Include:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept (if safe to share)
- Affected versions
- Any suggested mitigations you are aware of

You will receive an acknowledgement within **48 hours** and a status update within **7 days**. If the issue is confirmed, we will work with you on a coordinated disclosure timeline before publishing a fix.

## Scope

This policy covers the ZureMap application source code. It does **not** cover:

- Third-party dependencies (report those upstream)
- Azure infrastructure or tenant configuration outside this repo
- Issues that require physical access to a user's machine

## Disclosure Policy

Once a fix is released, a security advisory will be published on the [GitHub Security Advisories](https://github.com/natechsa/ZureMap/security/advisories) page. Credit will be given to the reporter unless anonymity is requested.

## Security Best Practices for Contributors

- Never commit credentials, tokens, or subscription IDs — use environment variables or `.env` files (already in `.gitignore`)
- Azure tokens are handled via MSAL; do not cache or log access tokens
- Keep dependencies up to date; Dependabot is enabled for this repository
