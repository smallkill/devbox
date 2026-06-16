---
title: Autonomous Vehicle HMI (Thailand deployment)
role: Computer Vision / HMI development
org: WHETRON
period: 2019 – 2020
tech: [ROS, WebSocket, HMI, Computer Vision, Ultrasonic Radar, Embedded]
cover: /projects/av-hmi/cover.webp
slideshows:
  - caption: "Live field run in Thailand: night-time, low speed in Auto mode; the on-board screen flags the pedestrian ahead in real time (5.3 km/h, route progress Head Office→HABITO, Auto status)"
    fit: contain
    images:
      - /projects/av-hmi/thailand.jpg
  - caption: "Rebuilt runnable demo (opens straight in a browser, simulated data): passenger view (speed / Auto / route / pedestrian & vehicle detection), driver/engineer view (top-down map with sonar arcs + camera object boxes, plus sensor-status panel), and sensor self-check"
    images:
      - /projects/av-hmi/demo/passenger.jpg
      - /projects/av-hmi/demo/driver.jpg
      - /projects/av-hmi/demo/sensor.jpg
gallery: []
video:
  src: /projects/av-hmi/demo.mp4
  caption: "Runnable demo in action (simulated data): real-time passenger dashboard → driver/engineer top-down view and sensor status"
links: []
featured: true
order: 6
---

A real-time human-machine interface (HMI) for an autonomous shuttle, deployed and operating in the field in Thailand.

The interface shows key vehicle state (speed, route progress, Auto self-driving mode) and renders a live 3D view of the
surroundings with detected pedestrians and obstacles (the pedestrian ahead in the photo is flagged by the system). The backend
fuses ultrasonic radar and computer-vision signals, transmitted via ROS over WebSocket, with edge-side processing and display
for intuitive, reliable situational awareness for driver and passengers.

> The photo is from live operation in Thailand: the vehicle drives in Auto mode at low speed while the interface flags a pedestrian ahead in real time.
