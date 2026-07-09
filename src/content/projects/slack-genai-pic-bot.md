---
title: "GenAI 이미지 스타일 변환 봇"
description: "Slack에서 이미지를 첨부하고 스타일을 지정하면 AWS Bedrock으로 스타일 변환된 이미지를 생성하는 봇"
publishedAt: 2025-04-15T00:00:00.000Z
featured: false
image: https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800&h=600&fit=crop
tags: ["AI", "AWS Bedrock", "Image Generation", "Slack", "Serverless"]
github: "https://github.com/DouglasMin/slack-genai-pic-bot"
order: 10
category: "portfolio"
---

## 프로젝트 개요

Slack에서 이미지를 첨부하고 원하는 스타일(예: ghibli)을 멘션하면 AWS Bedrock의 이미지 생성 모델을 활용하여 스타일 변환된 이미지를 스레드에 답장하는 봇입니다.

## 주요 기능

- Slack 멘션 기반 이미지 스타일 변환 요청
- AWS Bedrock (Stable Image Core / Nova Lite) 기반 이미지 생성
- S3 기반 이미지 저장 및 프리사인 URL 공유
- 스레드 단위 비동기 응답

## 기술 스택

**Runtime**: Node.js, Serverless Framework
**AI**: AWS Bedrock Runtime (Stable Image Core, Nova Lite)
**Storage**: S3, DynamoDB
**Integration**: Slack Web API
