---
title: Router Firmware CI/CD Pipeline (GitLab)
role: Senior Software Engineer · CI/CD & DevSecOps
org: Moxa
period: 2023 – 2026
tech: [GitLab CI/CD, Coverity, Nessus, SAST, DAST, Shell, Python]
cover: /projects/moxa-cicd/cover.svg
gallery:
  - { src: /projects/moxa-cicd/automation.png, caption: Post-deploy RDLAB (BVT) and SQA (Regression) automated testing, integrated with Nessus security scanning }
links: []
featured: true
order: 3
---

A GitLab CI/CD pipeline for router firmware development, supporting 9 router products across 5 series.
Under high-frequency development (~5 commits/day, 160 commits/month), it keeps build success, quality, and
security continuously verifiable.

The pipeline automates Build Firmware → upload artifact to SCM → deploy firmware → automated testing, and
puts Shift-Left Security into practice: Coverity (SAST) for static analysis at build time, and Nessus (DAST)
for dynamic scanning of deployed firmware — both wired into daily CI to proactively detect vulnerabilities
without slowing development.

After deployment, RDLAB (BVT) and SQA (Regression) automated tests validate on real hardware. The automation
surfaces integration issues up to 7 days earlier than the manual process, markedly improving firmware reliability.
