---
title: "Serverless Strands Agent"
description: "AWS AgentCore + Strands Agent 기반 서버리스 AI 챗봇. OAuth 3LO 통합(GitHub, Google Calendar, Notion)과 메모리 시스템"
publishedAt: 2025-06-20T00:00:00.000Z
featured: true
image: https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=600&fit=crop
tags: ["AI", "AWS AgentCore", "Strands", "Terraform", "Serverless"]
github: "https://github.com/DouglasMin/serverless-strands-agent"
order: 7
category: "portfolio"
---

## 프로젝트 개요

AWS AgentCore Runtime 위에서 Strands Agent를 실행하는 서버리스 AI 챗봇 아키텍처입니다. AgentCore Identity(3LO OAuth)로 GitHub, Google Calendar, Notion과 통합되며, STM/LTM 메모리 시스템을 갖추고 있습니다.

## 주요 기능

- SSE 스트리밍 기반 실시간 대화
- AgentCore Memory (단기 + 장기 기억: Summarization, User Preference, Semantic)
- AgentCore Gateway 도구 (Yahoo Finance, Tavily Search)
- OAuth 3LO 통합 (GitHub, Google Calendar, Notion)

## 기술 스택

**Frontend**: React 19, Vite, TypeScript
**Backend**: Lambda (Node.js 22, Container Image, ARM64)
**Agent**: AgentCore Runtime (Firecracker microVM), Strands Agents (Python)
**Infra**: Terraform, CloudFront + S3, DynamoDB
