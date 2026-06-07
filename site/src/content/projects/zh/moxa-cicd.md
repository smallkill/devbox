---
title: 路由器韌體 CI/CD Pipeline(GitLab)
role: 資深軟體工程師 · CI/CD & DevSecOps
org: 四零四科技 Moxa
period: 2023 – 2026
tech: [GitLab CI/CD, Coverity, Nessus, SAST, DAST, Shell, Python]
cover: /projects/moxa-cicd/cover.png
gallery:
  - { src: /projects/moxa-cicd/automation.png, caption: 部署後串接 RDLAB(BVT)與 SQA(Regression)自動化測試,並整合 Nessus 安全掃描 }
links: []
featured: true
order: 3
---

為路由器韌體開發建置的 **GitLab CI/CD pipeline**,支援 **5 個產品系列共 9 款路由器**,
在每天約 **5 次 commit**(160 commits/月)的高頻開發下,確保建置成功、品質與安全可被持續驗證。

Pipeline 自動化:**Build Firmware → 上傳 Artifact 至 SCM → 部署韌體 → 自動化測試**,並落實
**Shift-Left Security** —— 以 **Coverity(SAST)** 在建置階段做靜態分析、**Nessus(DAST)** 對部署後韌體做
動態掃描,兩者整合進日常 CI,**主動偵測漏洞且不拖慢開發**。

部署後再串接 **RDLAB(BVT)** 與 **SQA(Regression)** 自動化測試實機驗證。自動化工作流讓團隊
**比傳統手動流程提前最多 7 天**發現整合問題,顯著提升韌體可靠度。
