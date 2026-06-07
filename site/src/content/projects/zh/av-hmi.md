---
title: 自駕車 HMI 人機介面(泰國場域)
role: 電腦視覺 / HMI 開發
org: 輝創電子 WHETRON
period: 2019 – 2020
tech: [ROS, WebSocket, HMI, 電腦視覺, 超音波雷達, 嵌入式]
cover: /projects/av-hmi/cover.jpg
gallery: []
links: []
featured: true
order: 6
---

為自駕接駁車開發的**即時人機介面(HMI)**,實際部署於**泰國**場域運行。

介面顯示關鍵車況——**時速、路線進度、Auto 自駕模式狀態**,並即時繪出車輛周圍的 3D 視角與**偵測到的行人/障礙物**
(畫面中前方的行人即被系統標出)。後端融合**超音波雷達**與**電腦視覺**訊號,透過 **ROS over WebSocket** 傳輸,
在邊緣端同時完成資料處理與顯示,提供駕駛/乘客直覺、可靠的周圍感知。

> 此照片為泰國實地運行畫面:車輛以 Auto 模式低速行駛,介面即時標示前方行人。
