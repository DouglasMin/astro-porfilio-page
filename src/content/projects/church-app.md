---
title: "OO교회 앱"
description: "교회 청년부 전용 Flutter 앱. 중보기도, 출결, 송리스트 등 파편화된 기능을 단일 앱으로 통합"
publishedAt: 2026-08-06T00:00:00.000Z
featured: false
tags: ["Flutter", "AWS", "Serverless", "DynamoDB", "Mobile"]
order: 6
category: "client"
---

## 프로젝트 개요

OO교회 청년부의 중보기도, 출결, 송리스트 등 파편화된 기능을 하나의 모바일 앱으로 통합하는 프로젝트입니다.

## 주요 기능

- 회원 인증 (이름 + 비밀번호, 첫 로그인 시 비번 변경 강제)
- 중보기도 작성/조회/삭제 (익명/실명 선택)
- 기간별 필터링 및 읽음 표시
- 주간 푸시 알림 (매주 토요일 20:00 KST)

## 기술 스택

**Frontend**: Flutter (iOS/Android), Riverpod, GoRouter
**Backend**: Serverless Framework v4, Node.js 22, TypeScript
**DB**: DynamoDB (Single Table Design)
**Push**: AWS SNS → APNs
**API**: API Gateway (REST) + Lambda Authorizer
