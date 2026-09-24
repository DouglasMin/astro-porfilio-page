import { App } from 'aws-cdk-lib';
import { AnalyticsStack } from '../lib/analytics-stack.ts';

const app = new App();

const siteOrigins: unknown = app.node.tryGetContext('siteOrigins');
if (!Array.isArray(siteOrigins) || siteOrigins.length === 0 || !siteOrigins.every((origin) => typeof origin === 'string')) {
  throw new Error('cdk.json context "siteOrigins" must be a non-empty list of origins');
}

new AnalyticsStack(app, 'PortfolioAnalytics', {
  siteOrigins,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'ap-northeast-2' },
  description: 'Visitor analytics for the portfolio site (collector, counters, admin stats)',
});
