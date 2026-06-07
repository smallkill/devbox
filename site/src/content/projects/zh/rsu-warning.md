---
title: 路側單元(RSU)路口警示系統
role: 邊緣運算 + 雲端整合
org: 台灣智慧駕駛 TURING DRIVE
period: 2021 – 2023
tech: [Nvidia NX, YOLO, AWS KVS, Lambda, S3, MQTT, V2X]
cover: /projects/rsu-warning/cover.png
gallery:
  - { src: /projects/rsu-warning/cam.png, caption: 路口攝影機畫面與偵測區域標定 }
links: []
featured: true
order: 4
---

針對**無號誌路口**的自駕車安全方案。路側單元(RSU)架設於路口,在 **Nvidia NX** 邊緣平台上以 **YOLO**
即時偵測來車與行人,標定偵測區域並判斷碰撞風險,透過 **MQTT(V2X)** 將警示即時傳給自駕車,實現提前防撞。

雲端側以 **AWS KVS / Lambda / S3** 構成影像串流、儲存與警示管理服務,設計兼顧低延遲與高可靠。
此系統屬政府自駕計畫的一環,我擔任技術負責人,協調演算法、嵌入式與雲端團隊穩定交付。
