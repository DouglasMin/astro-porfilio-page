---
title: "Slack Multi-Agent System"
description: "8개 전문 AI 에이전트가 Slack 멘션에 따라 작업을 분담하는 멀티에이전트 시스템 (코드 분석, 보안 스캔, 인프라 모니터링 등)"
publishedAt: 2025-02-01T00:00:00.000Z
featured: false
image: https://images.unsplash.com/photo-1531746790095-e6e66d0dcbb5?w=800&h=600&fit=crop
tags: ["AI", "Multi-Agent", "Slack", "OpenAI", "AWS"]
github: "https://github.com/DouglasMin/multi-agent-slack-worker"
order: 9
category: "portfolio"
---

## 프로젝트 개요

Slack 채널에서 봇 멘션에 따라 8개 전문 AI 에이전트가 작업을 분담하는 멀티에이전트 시스템입니다. 비동기 이벤트 드리븐 파이프라인으로 Slack 3초 타임아웃 제약을 해결합니다.

## 에이전트 구성

- **Backend Agent**: 코드 분석, PR 생성, 버그 리포트
- **Frontend Agent**: 프론트엔드 PR 코드 리뷰
- **Trend Agent**: 웹 검색 및 트렌드 요약
- **Monitor Agent**: CloudWatch 로그 / AWS 비용 분석
- **Deploy Agent**: 배포 상태 확인 / CodePipeline 롤백
- **Data Agent**: 안전한 SELECT 쿼리 실행
- **Security Agent**: PR 취약점/시크릿/IAM 와일드카드 스캔
- **Docs Agent**: 레포 파일 읽기 및 문서 작성/업데이트

## 기술 스택

**Runtime**: Node.js 20+, Serverless Framework
**Architecture**: API Gateway → SQS (에이전트별 큐) → Lambda
**AI**: OpenAI @openai/agents
**State**: DynamoDB (스레드별 세션, 24h TTL)
