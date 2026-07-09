---
title: "AI Financial Briefing Bot (Slack)"
description: "GPT-5 기반 Slack 금융 브리핑 봇. 정기 브리핑, Slash 커맨드 실시간 조회, 자유 대화 기능"
publishedAt: 2025-03-01T00:00:00.000Z
featured: false
image: https://images.unsplash.com/photo-1563986768609-322da13575f2?w=800&h=600&fit=crop
tags: ["AI", "Slack", "OpenAI", "Serverless", "Finance"]
github: "https://github.com/DouglasMin/slack-financial-bot"
order: 8
category: "portfolio"
---

## 프로젝트 개요

OpenAI GPT-5를 활용한 Slack 기반 AI 금융 브리핑 봇입니다. 매일 아침/저녁 코인·주식·환율·뉴스를 종합 분석하여 자동 발송하고, Slash 커맨드와 자유 대화를 지원합니다.

## 주요 기능

- 정기 브리핑 (오전 9시 / 오후 6시 KST 자동 발송)
- Slash Commands: `/brief`, `/watch`, `/alert`, `/history`, `/summary`
- 자유 대화 (봇 멘션 또는 DM, OpenAI Agents SDK 기반)
- 가격 알림 (5분 주기 모니터링, 목표가 도달 시 DM)

## 기술 스택

**Runtime**: Node.js 22, Serverless Framework v4
**Cloud**: AWS Lambda, DynamoDB, EventBridge
**AI**: OpenAI GPT-5 / GPT-5-mini, @openai/agents
**APIs**: OKX (코인), Alpha Vantage (주식), ExchangeRate-API (환율)
