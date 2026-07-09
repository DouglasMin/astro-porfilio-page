---
title: "AI Financial Assistant"
description: "AWS Bedrock AgentCore 기반 개인 AI 금융 어시스턴트. Bloomberg 터미널 스타일 UI와 LangGraph 리서치 서브그래프"
publishedAt: 2025-05-01T00:00:00.000Z
featured: true
image: https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=600&fit=crop
tags: ["AI", "AWS AgentCore", "LangGraph", "React", "Finance"]
github: "https://github.com/DouglasMin/finance-ai-app"
order: 4
category: "portfolio"
---

## 프로젝트 개요

Slack 금융 봇을 웹 UI로 포팅한 Phase 1 프로젝트. LangChain 오케스트레이터와 LangGraph 리서치 서브그래프(병렬 시세 + 뉴스 → 분석)로 동작하는 Bloomberg 터미널 스타일 금융 어시스턴트입니다.

## 주요 기능

- 멀티세션 대화형 금융 분석
- 자동 모닝/이브닝 브리핑 생성 (EventBridge 스케줄링)
- 관심 종목 관리 및 실시간 시세 조회
- LangGraph 병렬 리서치 (시세 + 뉴스 동시 수집 → 종합 분석)

## 기술 스택

**Frontend**: React 19, Vite, TailwindCSS v4
**Backend**: Python, LangChain, LangGraph, AgentCore Runtime
**Infra**: CDK v2, Cognito, DynamoDB, CloudFront
**LLM**: Bedrock Claude / OpenAI (스위처블)
