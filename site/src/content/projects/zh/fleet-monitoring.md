---
title: 自駕車隊監控與遠端遙控平台
role: 主任工程師 · 雲端架構主導
org: 台灣智慧駕駛 TURING DRIVE
period: 2020 – 2023
tech: [AWS, MQTT, ROS, Autoware, WebSocket, Node.js, Vue, IoT Core]
cover: /projects/fleet-monitoring/cover.webp
platforms:
  - { label: "🏌️ 高爾夫球車", image: /projects/fleet-monitoring/smartkart.png, video: /projects/fleet-monitoring/smartkart.mp4, caption: "高爾夫球場自駕球車車隊 OCC — 衛星地圖上即時車隊定位、租借/歸還狀態、車速與路線。" }
  - { label: "🚗 自駕車與工作車輛監控", image: /projects/fleet-monitoring/kennel.png, video: /projects/fleet-monitoring/kennel.mp4, caption: "港區自駕/工作車隊 OCC — 即時定位 + 地理圍籬區域監控(point-in-polygon 判斷車輛在哪一區、是否跑出區域)+ 車輛沿港區道路行駛。" }
  - { label: "🛡️ 任務巡邏車", image: /projects/fleet-monitoring/bigmac.png, video: /projects/fleet-monitoring/bigmac.mp4, caption: "自駕巡邏/任務車 OCC — 規劃起點→終點路線、沿路導航到目標停靠點、即時軌跡與遠端指令。" }
links: []
featured: true
order: 4
---

從零在 **AWS** 上設計並建置的自駕車隊**即時監控與遠端遙控平台**,整合 **13 台自駕車(4 種車型)**——
自駕接駁車、智慧高爾夫球車、可遠端操控的無人車。

平台以 **AWS IoT SDK 訂閱車端 ROS topics**、經 **MQTT** 串流上雲;反向亦可——使用者在瀏覽器下達控制指令,
系統收 MQTT 訊號後轉成 ROS message 交由車輛執行,達 **sub-second 低延遲**。後端用 EC2 / Lambda / S3 / API Gateway 構成,
前端為全端響應式儀表板,支援即時狀態追蹤、歷史資料分析與遠端介入操作。

我並**創立並領導 Cloud Operations Team**,建立此平台的開發流程、運維標準與最佳實踐,確保系統可擴展性與穩定性。
