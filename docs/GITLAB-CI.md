# GitLab CI/CD Security Integration - csbrainai

This project is integrated with GitLab CI/CD (mirroring to `gitlab.com/razonin4k/csbrainai-ci`) to run automated security scanning and vulnerability checks.

## Pipeline Scoping
To optimize runner usage and prevent scanner noise on feature branches, the pipeline is configured with a global `workflow:rules` constraint. Pipelines will **only run on commits to the `main` branch**.

## Security Scanners Enabled

### 1. SAST (Static Application Security Testing)
- **Purpose:** Analyzes the source code statically to identify vulnerability patterns, security flaws, and code quality weaknesses before deployment.
- **Template:** `Jobs/SAST.gitlab-ci.yml`

### 2. Secret Detection
- **Purpose:** Scans the repository files and commit history to detect accidentally exposed API keys, private tokens, passwords, and other credentials, preventing leaks.
- **Template:** `Jobs/Secret-Detection.gitlab-ci.yml`

### 3. Dependency Scanning
- **Purpose:** Evaluates project dependencies (e.g. `package.json`, lockfiles) to identify third-party packages with known vulnerabilities (CVEs) and warns of needed updates.
- **Template:** `Jobs/Dependency-Scanning.v2.gitlab-ci.yml`

### 4. DAST (Dynamic Application Security Testing)
- **Purpose:** Runs dynamic vulnerability scans against the deployed application's staging/preview URL to check for live runtime vulnerabilities (such as XSS, SQLi, and configuration flaws).
- **Target URL:** `https://csbrainai-git-main-razs-projects-29d4f2e6.vercel.app`
- **Trigger Rule:** **Manual Only**. For safety, the `dast` job must be manually triggered from the GitLab pipeline interface to prevent automated active scans on every push.
- **Template:** `DAST.gitlab-ci.yml`
