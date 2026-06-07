---
title: 3D 環景監控 + 停車格偵測(3D AVM)
role: 電腦視覺 / ADAS 演算法工程師
org: 輝創電子 WHETRON
period: 2015 – 2020
tech: [OpenCV, OpenGL ES, 3D 重建, 魚眼校正, C++, Nvidia, Fujitsu]
cover: /projects/avm-3d/cover.png
slideshows:
  - caption: 自主研發版(含 PLD 停車格偵測)— 環景鳥瞰,紅框即時標示偵測到的可用停車格,支援自動停車
    images:
      - /projects/avm-3d/self/1.jpg
      - /projects/avm-3d/self/2.jpg
      - /projects/avm-3d/self/3.jpg
      - /projects/avm-3d/self/4.jpg
      - /projects/avm-3d/self/5.jpg
  - caption: 富士通平台版(交付泰國車廠)— 環景鳥瞰 + 後鏡頭,含停車偵測、導引線與距離標記等多種模式
    images:
      - /projects/avm-3d/thai/1.jpg
      - /projects/avm-3d/thai/2.jpg
      - /projects/avm-3d/thai/3.jpg
      - /projects/avm-3d/thai/4.jpg
gallery:
  - { src: /projects/avm-3d/perspective-1.jpg, caption: 自主研發版 — 3D 環景視角,四顆魚眼去畸變後投影融合,重建車輛周圍立體環境 }
  - { src: /projects/avm-3d/perspective-2.png, caption: 自主研發版 — 不同視角的 3D 環景渲染 }
links:
  - { label: avm_pld repo, href: "https://github.com/smallkill/avm_pld" }
featured: true
order: 8
---

自主研發的 **3D Around View Monitoring(3D AVM)** 系統,將前、後、左、右四顆魚眼攝影機的影像,
經去畸變、定位對齊後投影,融合重建成統一的 **3D 立體環景模型**,用於車輛環境感知與自動停車。

核心技術包含**魚眼鏡頭校正**、影像投影與接縫拼接,以及在嵌入式平台(Fujitsu、Nvidia)上以
OpenCV 與 OpenGL ES 完成即時 3D 重建與渲染。系統設計成可跨任意嵌入式平台,並延伸出**停車格偵測**功能,
整合進自動停車產品。

此技術有兩條交付成果:

- **富士通(Fujitsu)系統平台**版本,交付**泰國車廠**並進入其供應鏈,達 Tier 1 車規量產級交付。
- **自主研發**版本,整合**停車格偵測(PLD)**——在環景鳥瞰上即時標示可用停車格、支援自動停車;此版以**技術轉移**交付**中國輝創(Whetron 蘇州子公司)**,再由其整合並交付終端客戶。

展現符合車規嚴格要求、且能跨平台與跨團隊移轉的量產級軟體交付能力。(自主研發 AVM+PLD 程式碼見下方 `avm_pld` repo。)
