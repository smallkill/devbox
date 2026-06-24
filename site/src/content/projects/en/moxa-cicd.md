---
title: Router Firmware CI/CD Pipeline (GitLab)
role: Senior Software Engineer · CI/CD & DevSecOps
org: Moxa
period: 2023 – 2026
tech: [GitLab CI/CD, ISO 26262, Coverity, Nessus, SAST, DAST, Shell, Python]
cover: /projects/moxa-cicd/cover.webp
stats:
  - { value: "9 routers · 5 series", label: "Models and product series one pipeline covers" }
  - { value: "Up to 7 days earlier", label: "Integration issues caught vs. the manual process" }
  - { value: "~160 commits/mo", label: "Build & quality verified under high-frequency dev" }
  - { value: "Coverity + Nessus", label: "SAST and DAST wired into daily CI (shift-left)" }
gallery:
  - { src: /projects/moxa-cicd/automation.png, caption: Post-deploy RDLAB (BVT) and SQA (Regression) automated testing, integrated with Nessus security scanning }
links: []
featured: true
order: 3
---

## Problem

Router firmware spans **5 product series across 9 models**, developed at high frequency
(**~160 commits/month**). The manual integration process was slow, integration
issues surfaced late, and security testing sat outside the daily development loop — so defects and
vulnerabilities tended to leak downstream, and reproducible build quality across hardware
architectures was hard to hold steady.

## Approach

- **Scalable GitLab CI pipeline** that covers all 9 models / 5 product series in one flow, keeping reproducible build quality across hardware architectures.
- **Fully automated workflow**: Build Firmware → upload artifact to SCM → deploy firmware → automated testing, then **RDLAB (BVT)** and **SQA (Regression)** validation on real hardware after deployment.
- **Shift-Left Security**: **Coverity (SAST)** for static analysis at build time and **Nessus (DAST)** for dynamic scanning of deployed firmware, both wired into **daily CI** to detect vulnerabilities proactively without slowing development.
- **In-house tooling and test environment**: internal tools built in **Python / Shell**, plus a stable **VM + network test environment** to support continuous, repeatable automated testing.

## Impact

Automated build and integration let the team catch integration issues **up to 7 days earlier than
the manual process**, moving defects to an earlier stage and reducing the risk of leakage. Daily
Coverity static analysis and Nessus dynamic scanning shifted security testing into the development
loop so vulnerabilities surface sooner, and a single pipeline serving 9 models / 5 series held
reproducible build quality steady across hardware architectures. The whole flow is built to the
software-development and supporting-process requirements of **ISO 26262 (automotive functional
safety)**, using automated testing, static analysis, and traceable verification to give
safety-related firmware the rigor and compliance automotive grade demands.
