---
title: 路側單元(RSU)路口警示系統
role: 邊緣運算 + 雲端整合
org: 台灣智慧駕駛 TURING DRIVE
period: 2021 – 2023
tech: [Nvidia NX, YOLO, AWS KVS, Lambda, S3, MQTT, V2X]
cover: /projects/rsu-warning/cover.jpg
gallery:
  - { src: /projects/rsu-warning/cam.png, caption: 路口攝影機畫面與偵測區域標定 }
links:
  - { label: 計畫頁 · Turing Drive, href: "https://turing-drive.com/featured_item/%E6%A1%83%E5%9C%92%E5%B8%82%E9%9D%92%E5%9F%94%E5%9C%B0%E5%8D%80%E8%87%AA%E9%A7%95%E5%B7%B4%E5%A3%AB%E5%89%B5%E6%96%B0%E5%AF%A6%E9%A9%97%E8%A8%88%E7%95%AB/" }
  - { label: 媒體報導 · INSIDE, href: "https://www.inside.com.tw/article/25555-2021-taoyuan-smart-city" }
featured: true
order: 5
---

針對**無號誌路口**的自駕車安全方案。路側單元(RSU)架設於路口,在 **Nvidia NX** 邊緣平台上以 **YOLO**
即時偵測來車與行人,標定偵測區域並判斷碰撞風險,透過 **MQTT(V2X)** 將警示即時傳給自駕車,實現提前防撞。

雲端側以 **AWS KVS / Lambda / S3** 構成影像串流、儲存與警示管理服務,設計兼顧低延遲與高可靠。
我擔任技術負責人,協調演算法、嵌入式與雲端團隊穩定交付。

**部署規模與成果** — 應用於 **桃園市青埔自駕巴士創新實驗計畫**(全國首條捷運接駁、深入社區的自駕巴士路線):

- 路側系統涵蓋 **7 個路口、共 11 台監視器**,即時守護混合車流的複雜路口。
- 2021 年試運行(平日 10:00–15:40、每 20 分一班),累計 **載客破千人次**、**逾 9 成試乘滿意度**。
- 估算營運約 **1,000 趟次**;以每趟於路口觸發 1–2 次示警估計,累積對自駕巴士**提前示警約 1,000–2,000 次**。
