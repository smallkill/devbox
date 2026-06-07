---
title: Autonomous Fleet Monitoring & Remote-Control Platform
role: Principal Engineer · cloud architecture lead
org: TURING DRIVE
period: 2020 – 2023
tech: [AWS, MQTT, ROS, Autoware, WebSocket, Node.js, Vue, IoT Core]
cover: /projects/fleet-monitoring/cover.png
gallery:
  - { src: /projects/fleet-monitoring/dashboard.png, caption: Fleet overview — per-vehicle rental/operational status with live positions on the map }
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
