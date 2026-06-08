---
title: Autonomous Vehicle HMI (Thailand deployment)
role: Computer Vision / HMI development
org: WHETRON
period: 2019 – 2020
tech: [ROS, WebSocket, HMI, Computer Vision, Ultrasonic Radar, Embedded]
cover: /projects/av-hmi/cover.jpg
gallery:
  - { src: /projects/av-hmi/thailand.jpg, caption: "Live in Thailand — running in Auto mode at night; the HMI marks a pedestrian ahead in real time (speed, route progress, Auto status)" }
links: []
featured: true
order: 6
---

A real-time human-machine interface (HMI) for an autonomous shuttle, deployed and operating in the field in Thailand.

The interface shows key vehicle state — speed, route progress, Auto self-driving mode — and renders a live 3D view of the
surroundings with detected pedestrians and obstacles (the pedestrian ahead in the photo is flagged by the system). The backend
fuses ultrasonic radar and computer-vision signals, transmitted via ROS over WebSocket, with edge-side processing and display
for intuitive, reliable situational awareness for driver and passengers.

> The photo is from live operation in Thailand: the vehicle drives in Auto mode at low speed while the interface flags a pedestrian ahead in real time.
