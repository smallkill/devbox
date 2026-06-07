---
title: Roadside Unit (RSU) Intersection Warning System
role: Edge computing + cloud integration
org: TURING DRIVE
period: 2021 – 2023
tech: [Nvidia NX, YOLO, AWS KVS, Lambda, S3, MQTT, V2X]
cover: /projects/rsu-warning/cover.png
gallery:
  - { src: /projects/rsu-warning/cam.png, caption: Intersection camera view with detection zones }
links:
  - { label: Project · Turing Drive, href: "https://turing-drive.com/featured_item/%E6%A1%83%E5%9C%92%E5%B8%82%E9%9D%92%E5%9F%94%E5%9C%B0%E5%8D%80%E8%87%AA%E9%A7%95%E5%B7%B4%E5%A3%AB%E5%89%B5%E6%96%B0%E5%AF%A6%E9%A9%97%E8%A8%88%E7%95%AB/" }
  - { label: "Press · INSIDE", href: "https://www.inside.com.tw/article/25555-2021-taoyuan-smart-city" }
featured: true
order: 5
---

A safety solution for autonomous vehicles at unsignalized intersections. A Roadside Unit (RSU) mounted at the intersection
runs YOLO on an Nvidia NX edge platform to detect oncoming vehicles and pedestrians in real time, marks detection zones,
assesses collision risk, and transmits alerts to self-driving cars over MQTT (V2X) for early collision avoidance.

On the cloud side, AWS KVS / Lambda / S3 form the video-streaming, storage, and alert-management services, designed for
low latency and high reliability. I served as technical lead, coordinating the algorithm, embedded, and cloud teams to deliver reliably.

**Scale & results** — deployed for the **Taoyuan Qingpu Autonomous Bus pilot** (Taiwan's first autonomous bus line offering MRT-station connection and reaching into communities):

- Roadside system covered **7 intersections with 11 cameras**, guarding complex mixed-traffic junctions in real time.
- 2021 trial run (weekdays 10:00–15:40, ~20-min headway) carried **1,000+ passengers** with **90%+ rider satisfaction**.
- An estimated **~1,000 trips**; at 1–2 intersection alerts per trip, that is roughly **1,000–2,000 advance warnings** delivered to the autonomous bus.
