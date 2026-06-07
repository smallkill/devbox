---
title: DevOps Pipeline Implementation (GitLab CI/CD)
role: DevOps · CI/CD automation
org: AncillaryPower
period: "2026"
tech: [Node.js, Express, GitLab CI/CD, ESLint, Prettier, Jest, husky]
cover: /projects/ancillarypower-devops/cover.svg
gallery: []
links:
  - { label: GitHub, href: "https://github.com/smallkill/ancillarypower-devops-implement" }
featured: true
order: 2
---

An end-to-end automated GitLab CI/CD implementation: a minimal layered Node.js + Express backend
(config / controllers / routes / services) exposing `/health`, `/api/hello`, and `/api/items`,
paired with a complete pipeline.

Every `git commit` triggers a quality gate — ESLint (linter), Prettier (formatter), and Jest (API tests) —
with husky pre-commit as a first local guard. Once all checks pass, the pipeline automatically opens a
Merge / Pull Request via the GitLab API (with de-duplication to avoid duplicate MRs).

The philosophy mirrors my day-to-day at Moxa and AncillaryPower: shift quality and security left, and let
automation make every commit continuously verifiable — so the process guards itself instead of relying on people to watch it.
