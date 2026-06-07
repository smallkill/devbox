---
title: 3D Around View Monitoring + Parking Detection (3D AVM)
role: Computer Vision / ADAS algorithm engineer
org: WHETRON
period: 2015 – 2020
tech: [OpenCV, OpenGL ES, 3D Reconstruction, Fisheye Calibration, C++, Nvidia, Fujitsu]
cover: /projects/avm-3d/cover.png
gallery:
  - { src: /projects/avm-3d/perspective-1.jpg, caption: 3D surround view — four fisheye cameras de-warped, projected, and fused into a 3D model of the vehicle's surroundings }
  - { src: /projects/avm-3d/perspective-2.png, caption: 3D surround rendering from a different angle for intuitive driver awareness }
links:
  - { label: GitHub reference, href: "https://github.com/smallkill" }
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
- A **self-developed** version handed off via **technology transfer to Whetron China** (the Suzhou subsidiary), who integrated and delivered it to their end customer.

Together they demonstrate mass-production-grade software delivery that meets strict automotive requirements and transfers cleanly across platforms and teams.
