---
title: Roadside Unit (RSU) Intersection Warning System
role: Edge computing + cloud integration
org: TURING DRIVE
period: 2021 – 2023
tech: [Nvidia NX, YOLO, AWS KVS, Lambda, S3, MQTT, V2X]
cover: /projects/rsu-warning/cover.png
gallery:
  - { src: /projects/rsu-warning/cam.png, caption: Intersection camera view with detection zones }
links: []
featured: true
order: 5
---

A safety solution for autonomous vehicles at unsignalized intersections. A Roadside Unit (RSU) mounted at the intersection
runs YOLO on an Nvidia NX edge platform to detect oncoming vehicles and pedestrians in real time, marks detection zones,
assesses collision risk, and transmits alerts to self-driving cars over MQTT (V2X) for early collision avoidance.

On the cloud side, AWS KVS / Lambda / S3 form the video-streaming, storage, and alert-management services, designed for
low latency and high reliability. Part of a government autonomous-driving program, where I served as technical lead,
coordinating the algorithm, embedded, and cloud teams to deliver reliably.
