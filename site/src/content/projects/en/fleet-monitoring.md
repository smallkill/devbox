---
title: Autonomous Fleet Monitoring & Remote-Control Platform
role: Principal Engineer · cloud architecture lead
org: TURING DRIVE
period: 2020 – 2023
tech: [AWS, MQTT, ROS, Autoware, WebSocket, Node.js, Vue, IoT Core]
cover: /projects/fleet-monitoring/cover.webp
platforms:
  - { label: "🏌️ Golf carts (smartkart)", image: /projects/fleet-monitoring/smartkart.png, video: /projects/fleet-monitoring/smartkart.mp4, caption: "Self-driving golf-cart fleet OCC — live fleet positions on a satellite map, rent/return status, speed and routes." }
  - { label: "🚗 AV & work-vehicle monitoring (kennel)", image: /projects/fleet-monitoring/kennel.png, video: /projects/fleet-monitoring/kennel.mp4, caption: "Port AV/work-vehicle fleet OCC — live positions + geofence-zone monitoring (point-in-polygon: which zone a vehicle is in / whether it left), vehicles driving the port roads." }
  - { label: "🛡️ Mission patrol vehicle (bigmac)", image: /projects/fleet-monitoring/bigmac.png, video: /projects/fleet-monitoring/bigmac.mp4, caption: "Autonomous patrol/mission vehicle OCC — plan a start→goal route, navigate to a target stop point, live trajectory and remote commands." }
links: []
featured: true
order: 4
---

A real-time monitoring and remote-control platform for an autonomous fleet, designed and built from scratch on AWS,
integrating 13 autonomous vehicles across 4 types — self-driving shuttles, smart golf carts, and remotely operable vehicles.

The platform subscribes to on-vehicle ROS topics via the AWS IoT SDK and streams to the cloud over MQTT. The path is
bidirectional — a user issues a control command in the browser, the system receives the MQTT signal and converts it into a
ROS message for the vehicle to execute, at sub-second latency. The backend is composed of EC2 / Lambda / S3 / API Gateway,
with a full-stack responsive dashboard for live status, historical analysis, and remote intervention.

I also founded and led the Cloud Operations Team that built the platform's development workflow, ops standards, and best practices,
ensuring scalability and stability.
