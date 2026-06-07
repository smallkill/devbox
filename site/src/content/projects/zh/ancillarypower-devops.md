---
title: DevOps Pipeline 實作(GitLab CI/CD)
role: DevOps · CI/CD 自動化
org: 安瑟樂威 AncillaryPower
period: "2026"
tech: [Node.js, Express, GitLab CI/CD, ESLint, Prettier, Jest, husky]
cover: /projects/ancillarypower-devops/cover.svg
gallery: []
links:
  - { label: GitHub, href: "https://github.com/smallkill/ancillarypower-devops-implement" }
featured: true
order: 8
---

一套**端到端自動化的 GitLab CI/CD 實作**:以 Node.js + Express 建立分層架構的最小後端服務
(config / controllers / routes / services 分層,提供 `/health`、`/api/hello`、`/api/items` 端點),
並設計完整的 pipeline。

每次 `git commit` 後自動觸發,依序執行品質關卡——**ESLint(Linter)、Prettier(Formatter)、Jest(API 測試)**,
搭配 **husky pre-commit** 在本機先擋一層;全部通過後,再透過 **GitLab API 自動建立 Merge/Pull Request**(含查重,
避免重複建立)。

核心理念與我在 Moxa 與安瑟樂威的日常一致:**把品質與安全左移(Shift-Left)、用自動化讓每次提交都可被持續驗證**,
讓人不必盯流程、流程自己把關。
