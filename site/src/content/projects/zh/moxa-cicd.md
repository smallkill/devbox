---
title: 路由器韌體 CI/CD Pipeline(GitLab)
role: 資深軟體工程師 · CI/CD & DevSecOps
org: 四零四科技 Moxa
period: 2023 – 2026
tech: [GitLab CI/CD, ISO 26262, Coverity, Nessus, SAST, DAST, Shell, Python]
cover: /projects/moxa-cicd/cover.webp
stats:
  - { value: "9 款路由器 · 5 系列", label: "單一 pipeline 涵蓋的機型與產品系列" }
  - { value: "最多提前 7 天", label: "比人工流程更早發現整合問題" }
  - { value: "~160 commits/月", label: "高頻開發下持續驗證建置與品質" }
  - { value: "Coverity + Nessus", label: "SAST 與 DAST 整合進每日 CI(資安左移)" }
gallery:
  - { src: /projects/moxa-cicd/automation.png, caption: 部署後串接 RDLAB(BVT)與 SQA(Regression)自動化測試,並整合 Nessus 安全掃描 }
links: []
featured: true
order: 3
---

## 問題

路由器韌體要橫跨 **5 個產品系列、共 9 款機型**,在 **~160 commits/月** 的
高頻開發下,傳統人工整合流程慢、整合問題往往很晚才被發現,且資安檢測未被納入日常開發迴圈——
缺陷與漏洞容易一路外漏到後段,跨硬體架構的建置品質也難以保持一致。

## 做法

- **可擴展的 GitLab CI pipeline**,以單一流程涵蓋 9 款機型 / 5 個產品系列,維持跨硬體架構可重現的建置品質。
- **全自動化工作流**:Build Firmware → 上傳 Artifact 至 SCM → 部署韌體 → 自動化測試,部署後再串接 **RDLAB(BVT)** 與 **SQA(Regression)** 實機驗證。
- **資安左移(Shift-Left)**:**Coverity(SAST)** 在建置階段做靜態分析、**Nessus(DAST)** 對部署後韌體做動態掃描,兩者整合進**每日 CI**,主動偵測漏洞且不拖慢開發。
- **自建工具與測試環境**:用 **Python / Shell** 打造內部工具,並建置穩定的 **VM + 網路測試環境**,支撐持續且可重複的自動化測試。

## 成效

自動化建置與整合讓團隊**比人工流程最多提前 7 天**發現整合問題,把缺陷攔在更早的階段、降低外漏風險;
每日 Coverity 靜態分析與 Nessus 動態掃描把安全檢測前移到開發迴圈內,讓漏洞更早浮現;
單一 pipeline 同時服務 9 款機型 / 5 個系列,維持跨硬體架構可重現的建置品質。整體流程亦依循
**ISO 26262(車用功能安全)** 的軟體開發與支援流程要求建置,以自動化測試、靜態分析與可追溯的驗證,
確保安全相關韌體達到車規所需的嚴謹度與合規。
