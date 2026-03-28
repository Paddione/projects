# Security Policy

## Supported Versions

| Branch | Supported |
|--------|-----------|
| `master` (latest) | Yes |
| Older commits / tags | No |

Only the latest `master` branch receives security updates.

## Reporting a Vulnerability

**Please do NOT open public issues for security vulnerabilities.**

Use GitHub's private vulnerability reporting:

1. Go to the **Security** tab of this repository
2. Click **Report a vulnerability**
3. Fill out the form with the details below

### What to Include

- **Description**: Clear explanation of the vulnerability
- **Steps to reproduce**: Minimal steps to trigger the issue
- **Impact assessment**: What an attacker could achieve (data exposure, privilege escalation, etc.)
- **Affected component**: Which service or infrastructure component is affected (e.g., auth, l2p, k8s manifests)
- **Suggested fix** (optional): If you have a patch or mitigation in mind

### Response Timeline

| Action | Timeframe |
|--------|-----------|
| Acknowledgment of report | Within **48 hours** |
| Initial triage and severity assessment | Within **5 business days** |
| Patch for critical vulnerabilities | Within **14 days** |
| Patch for non-critical vulnerabilities | Best effort, typically within 30 days |

We will keep you informed of progress and coordinate disclosure timing with you.

## Out of Scope

The following are **not** considered valid security reports:

- Automated scanner output without verified exploitability
- Social engineering attacks (phishing, pretexting)
- Attacks requiring physical access to infrastructure
- Denial of service attacks against development/staging environments
- Issues in dependencies that are not reachable from this project's code paths
- Missing security headers on non-production environments

## PGP Key

No PGP key is currently configured. Please use GitHub's private vulnerability reporting as described above.

## Recognition

We appreciate responsible disclosure. Contributors who report valid security issues will be acknowledged (with permission) in the release notes for the fix.
