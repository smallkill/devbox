---
title: 3D Around View Monitoring + Parking Detection (3D AVM)
role: Computer Vision / ADAS algorithm engineer
org: WHETRON
period: 2015 – 2020
tech: [OpenCV, OpenGL ES, 3D Reconstruction, Fisheye Calibration, C++, Nvidia, Fujitsu]
cover: /projects/avm-3d/cover.webp
slideshows:
  - caption: Self-developed version (with Parking-Lot Detection) — bird's-eye surround, red boxes mark available parking spaces in real time, supporting automatic parking
    images:
      - /projects/avm-3d/self/1.jpg
      - /projects/avm-3d/self/2.jpg
      - /projects/avm-3d/self/3.jpg
      - /projects/avm-3d/self/4.jpg
      - /projects/avm-3d/self/5.jpg
      - /projects/avm-3d/perspective-2.png
  - caption: Fujitsu-platform version (delivered to Thai OEM) — bird's-eye surround + rear camera, with guidelines and distance markers across modes
    images:
      - /projects/avm-3d/thai/1.jpg
      - /projects/avm-3d/thai/2.jpg
      - /projects/avm-3d/thai/3.jpg
      - /projects/avm-3d/thai/4.jpg
gallery: []
links:
  - { label: AVM+PLD technical write-up, href: "https://smallkill.github.io/avm-pld-showcase/" }
featured: true
order: 8
---

A proprietary 3D Around View Monitoring (3D AVM) system that takes the front, rear, left, and right fisheye-camera images,
de-warps and aligns them, then projects and fuses them into a unified 3D model of the vehicle's surroundings — for perception
and automatic parking.

Core techniques include fisheye-camera calibration, image projection and seam stitching, and real-time 3D reconstruction and
rendering on embedded platforms (Fujitsu, Nvidia) using OpenCV and OpenGL ES. The system was designed to run on any embedded
platform and extended to parking-space detection integrated into automatic-parking products.

The technology shipped through two delivery tracks:

- A **Fujitsu-platform** version delivered to a **Thai car manufacturer**, entering its supply chain as a Tier 1, automotive mass-production-grade delivery.
- A **self-developed** version with **Parking-Lot Detection (PLD)** — flagging available parking spaces on the bird's-eye view in real time to support automatic parking; this version was handed off via **technology transfer to Whetron China** (the Suzhou subsidiary), who integrated and delivered it to their end customer.

Together they demonstrate mass-production-grade software delivery that meets strict automotive requirements and transfers cleanly across platforms and teams. (A technical write-up of the self-developed AVM+PLD is linked above; source code is private.)
