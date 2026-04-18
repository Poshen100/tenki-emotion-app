# Security Audit (CSO) — TENKI Adapted

> Adapted from gstack /cso (Garry Tan). Customized for TENKI CORE privacy-first architecture.

## Core Principle

> Think like an attacker, report like a defender.
> TENKI handles biometric data — privacy violations are CRITICAL by default.

## Modes

- `/cso` — Standard audit (confidence gate: 8/10)
- `/cso --comprehensive` — Deep scan (confidence gate: 2/10, mark low-confidence as TENTATIVE)
- `/cso --diff` — Only scan changed files since main

## Phases

### Phase 1: Architecture Scan

1. Read `ANTIGRAVITY.md` Section 3 (Privacy Architecture) for data classification
2. Map all data flows: where does biometric data go?
3. Identify system boundaries (device ↔ cloud, user input ↔ engine)

### Phase 2: TENKI Privacy Audit (ALWAYS RUN)

| Check | Severity | What to look for |
|-------|----------|-----------------|
| Raw biometric upload | CRITICAL | HR/HRV/RR data in any fetch/POST/upload/sync/API call |
| Unencrypted storage | CRITICAL | Biometric data in plain localStorage/AsyncStorage |
| Data leaking to logs | HIGH | Console.log/debug output containing biometric values |
| Missing consent | HIGH | Data collection without user consent flow |
| Cloud-minimal violation | HIGH | Sending device-only data to cloud beyond subscription/flags/benchmark |
| Missing data deletion | MEDIUM | No path to delete user's local data |
| Missing data export | MEDIUM | No path to export user's data |

### Phase 3: Secrets Scan

1. Grep for API keys, tokens, passwords in source code
2. Check `.env` files, config files, hardcoded credentials
3. Verify `.gitignore` covers sensitive files
4. Check git history for accidentally committed secrets: `git log --all -p -S "password\|secret\|api_key\|token" --diff-filter=A`

### Phase 4: Dependency Audit

1. Check `package.json` for known vulnerable packages
2. Run `npm audit` if available
3. Flag outdated dependencies with known CVEs

### Phase 5: OWASP Top 10 for Mobile

| OWASP Mobile | TENKI relevance |
|-------------|-----------------|
| M1: Improper credential storage | Keychain/Secure Enclave usage |
| M2: Insufficient transport security | HTTPS enforcement |
| M4: Insufficient input validation | User input in reflections/journal |
| M5: Insecure communication | Data in transit encryption |
| M8: Code tampering | App integrity checks |
| M9: Reverse engineering | Sensitive logic exposure |

### Phase 6: Compliance-Specific Checks

1. Verify `safe-copy.ts` blocks all forbidden terms (Section 2 of ANTIGRAVITY.md)
2. Verify `notification-guard.ts` filters unsafe push content
3. Check that no user-facing string bypasses compliance layer
4. Verify feature flags gate unreleased functionality

### Phase 7: STRIDE Threat Model

For each component (engine, scan, shared, domain):

| Threat | Question |
|--------|----------|
| **S**poofing | Can someone fake biometric input? |
| **T**ampering | Can Edge Score be manipulated? |
| **R**epudiation | Are scan sessions properly logged? |
| **I**nformation Disclosure | Can biometric data leak? |
| **D**enial of Service | Can scan pipeline be crashed? |
| **E**levation of Privilege | Can free user access premium features? |

### Phase 8: False Positive Filter

Auto-discard:
- DoS concerns without concrete exploit
- Test-only code vulnerabilities
- Theoretical memory leaks without evidence
- Race conditions without concrete attack path

NEVER discard:
- Privacy violations (any confidence level)
- Secrets in source code
- Raw biometric data exposure

### Phase 9: Report

```
SECURITY AUDIT — TENKI CORE
════════════════════════════
Date: <date>
Mode: Standard | Comprehensive | Diff
Scope: <files/packages scanned>

FINDINGS:
  [CRITICAL] (confidence: N/10) path:line
    Finding: <description>
    Attack: <step-by-step exploit scenario>
    Fix: <recommended remediation>

  [HIGH] ...
  [MEDIUM] ...

PRIVACY COMPLIANCE: [PASS | FAIL]
OWASP MOBILE: [N/10 categories checked]
STRIDE: [N threats modeled]

RECOMMENDATION: <summary>
```

## Rules

- **Read-only**: Never modify code. Only produce findings and recommendations.
- Every finding must include a concrete exploit scenario, not just "this is insecure"
- Privacy violations are CRITICAL regardless of confidence level
- This is not a substitute for professional penetration testing
