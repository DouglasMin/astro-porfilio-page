import { test } from 'node:test';
import assert from 'node:assert/strict';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AnalyticsStack } from '../lib/analytics-stack.ts';

const template = Template.fromStack(
  new AnalyticsStack(new App(), 'TestAnalytics', {
    siteOrigins: ['https://main.d3m8pthmupwl40.amplifyapp.com', 'http://localhost:4321'],
    env: { account: '123456789012', region: 'ap-northeast-2' },
  }),
);

test('table keeps data on stack deletion and expires raw events', () => {
  template.hasResource('AWS::DynamoDB::Table', {
    DeletionPolicy: 'Retain',
    Properties: Match.objectLike({
      BillingMode: 'PAY_PER_REQUEST',
      TimeToLiveSpecification: { AttributeName: 'expiresAt', Enabled: true },
    }),
  });
});

test('admin route is throttled harder than public routes', () => {
  template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
    DefaultRouteSettings: { ThrottlingRateLimit: 20, ThrottlingBurstLimit: 40 },
    RouteSettings: { 'GET /stats': { ThrottlingRateLimit: 1, ThrottlingBurstLimit: 5 } },
  });
});

test('stage is created after the routes its RouteSettings refer to', () => {
  const [stage] = Object.values(template.findResources('AWS::ApiGatewayV2::Stage'));
  const routeIds = Object.keys(template.findResources('AWS::ApiGatewayV2::Route'));
  assert.equal(routeIds.length, 3);
  for (const routeId of routeIds) assert.ok(stage?.DependsOn?.includes(routeId), `stage should depend on ${routeId}`);
});

test('CORS only allows the site origins', () => {
  template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
    CorsConfiguration: Match.objectLike({
      AllowOrigins: ['https://main.d3m8pthmupwl40.amplifyapp.com', 'http://localhost:4321'],
    }),
  });
});

test('CloudFront forwards viewer location headers to the API', () => {
  template.hasResourceProperties('AWS::CloudFront::OriginRequestPolicy', {
    OriginRequestPolicyConfig: Match.objectLike({
      HeadersConfig: {
        HeaderBehavior: 'whitelist',
        Headers: Match.arrayWith(['CloudFront-Viewer-Country', 'CloudFront-Viewer-City']),
      },
    }),
  });
});

test('only the admin function can read the token secret', () => {
  const policies = template.findResources('AWS::IAM::Policy');
  const readersOfSecret = Object.entries(policies).filter(([, policy]) =>
    JSON.stringify(policy).includes('secretsmanager:GetSecretValue'),
  );
  assert.equal(readersOfSecret.length, 1);
  assert.match(readersOfSecret[0]?.[0] ?? '', /AdminStats/);
});
