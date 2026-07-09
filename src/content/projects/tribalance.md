---
title: "TriBalance — AI 헬스 코치"
description: "Apple Health 데이터를 기반으로 수면·운동·스트레스 3축을 분석해 주간 라이프스타일 플랜을 생성하는 AI 에이전트"
publishedAt: 2025-06-01T00:00:00.000Z
featured: true
image: https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=600&fit=crop
tags: ["AI", "AWS AgentCore", "LangGraph", "React", "Python"]
github: "https://github.com/DouglasMin/aws-agentcore-TriBalance"
order: 3
category: "portfolio"
---

## 프로젝트 개요

Apple Health XML 데이터를 업로드하면 수면·운동·스트레스 3축을 분석하여 주간 라이프스타일 플랜을 생성하는 AI 헬스 코치입니다.

## 핵심 기술

- **AWS AgentCore Runtime + Code Interpreter**: LLM이 생성한 pandas 코드를 격리 샌드박스에서 실행, 프론트에 실시간 스트리밍
- **LangGraph + LangSmith**: 그래프-레벨 관측성과 AgentCore Observability(OTel) 병행
- **ATLAS UI**: mission-control 스타일 React 대시보드, 12-col grid, 라이브 timecode

## 기술 스택

**Frontend**: React, Vite, TypeScript (ATLAS UI)
**Backend**: Python, LangGraph, AWS AgentCore Runtime
**Infra**: CDK, Lambda Function URL (SSE), S3
