---
title: "No Brainrot — iOS 스크린타임 앱"
description: "6단계 캐릭터가 하루 사용량을 반영하는 디지털 웰빙 iOS 앱. 차단 없이 넛지로 습관 개선"
publishedAt: 2025-06-15T00:00:00.000Z
featured: true
image: https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=600&fit=crop
tags: ["iOS", "Swift", "SwiftUI", "Digital Wellbeing"]
github: "https://github.com/DouglasMin/screentime-productivity"
order: 5
category: "portfolio"
---

## 프로젝트 개요

차단하지 않고 넛지(nudge)로 사용자의 스크린타임 습관을 개선하는 iOS 앱입니다. 6단계 캐릭터가 하루 사용량에 따라 기분이 변하며, 자연스럽게 사용 패턴을 인식하도록 유도합니다.

## 주요 기능

- Apple Family Controls / DeviceActivity 기반 실시간 스크린타임 모니터링
- 6단계 캐릭터 시스템 (사용량 대비 목표 달성률 반영)
- 앱별 제한 설정 및 소프트 로컬 알림
- 100% 서버리스 — 백엔드 없음, 분석 없음, 서드파티 SDK 없음
- 영어/한국어 지원

## 기술 스택

**Platform**: iOS 16+, SwiftUI
**Build**: xcodegen (project.yml → .xcodeproj)
**Architecture**: App Group + DeviceActivity Extensions
**Notifications**: 로컬 푸시 (APNs 불필요)
