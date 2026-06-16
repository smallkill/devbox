---
title: 自駕車 HMI 人機介面(泰國場域)
role: 電腦視覺 / HMI 開發
org: 輝創電子 WHETRON
period: 2019 – 2020
tech: [ROS, WebSocket, HMI, 電腦視覺, 超音波雷達, 嵌入式]
cover: /projects/av-hmi/cover.webp
slideshows:
  - caption: 泰國實地運行,夜間以 Auto 模式低速行駛,車上螢幕即時標出前方行人(時速 5.3、路線進度 Head Office→HABITO、Auto 狀態)
    fit: contain
    images:
      - /projects/av-hmi/thailand.jpg
  - caption: 重建的可執行 Demo(瀏覽器直接跑,模擬資料):乘客畫面(時速/Auto/路線/前方行人與車輛偵測)、駕駛工程畫面(俯視圖含聲納扇形與相機物件框 + 感測器狀態板)、感測器自檢
    images:
      - /projects/av-hmi/demo/passenger.jpg
      - /projects/av-hmi/demo/driver.jpg
      - /projects/av-hmi/demo/sensor.jpg
gallery: []
video:
  src: /projects/av-hmi/demo.mp4
  caption: "可執行 Demo 實際運行(模擬資料):乘客即時儀表 → 駕駛/工程俯視圖與感測器狀態"
links: []
featured: true
order: 6
---

為自駕接駁車開發的**即時人機介面(HMI)**,實際部署於**泰國**場域運行。

介面顯示關鍵車況:**時速、路線進度、Auto 自駕模式狀態**,並即時繪出車輛周圍的 3D 視角與**偵測到的行人/障礙物**
(畫面中前方的行人即被系統標出)。後端融合**超音波雷達**與**電腦視覺**訊號,透過 **ROS over WebSocket** 傳輸,
在邊緣端同時完成資料處理與顯示,提供駕駛/乘客直覺、可靠的周圍感知。

> 此照片為泰國實地運行畫面:車輛以 Auto 模式低速行駛,介面即時標示前方行人。
