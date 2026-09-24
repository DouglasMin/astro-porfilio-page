import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { CorsHttpMethod, HttpApi, HttpMethod, type CfnStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';

export interface AnalyticsStackProps extends StackProps {
  /** Browser origins allowed to send events and read stats. */
  siteOrigins: string[];
}

const LAMBDA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lambda');

// Public endpoints absorb a normal blog's traffic; the admin route only needs a trickle,
// which also caps token guessing.
const PUBLIC_RATE_PER_SECOND = 20;
const PUBLIC_BURST = 40;
const ADMIN_RATE_PER_SECOND = 1;
const ADMIN_BURST = 5;

export class AnalyticsStack extends Stack {
  constructor(scope: Construct, id: string, props: AnalyticsStackProps) {
    super(scope, id, props);

    const siteHosts = props.siteOrigins.map((origin) => new URL(origin).hostname);
    const productionHost = siteHosts.find((host) => host !== 'localhost') ?? siteHosts[0] ?? '';

    const table = new Table(this, 'Events', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const adminToken = new Secret(this, 'AdminToken', {
      description: 'Token for the portfolio analytics /admin dashboard',
      generateSecretString: { passwordLength: 40, excludePunctuation: true },
    });

    const createFunction = (name: string, entry: string, environment: Record<string, string>) =>
      new NodejsFunction(this, name, {
        entry: path.join(LAMBDA_DIR, entry),
        runtime: Runtime.NODEJS_22_X,
        architecture: Architecture.ARM_64,
        memorySize: 256,
        timeout: Duration.seconds(10),
        environment: { TABLE_NAME: table.tableName, ...environment },
        logGroup: new LogGroup(this, `${name}Logs`, {
          retention: RetentionDays.ONE_MONTH,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        bundling: {
          format: OutputFormat.ESM,
          minify: true,
          sourceMap: false,
          externalModules: ['@aws-sdk/*'],
        },
      });

    const collectFn = createFunction('Collect', 'collect.ts', {
      ALLOWED_ORIGINS: props.siteOrigins.join(','),
      SITE_HOST: productionHost,
    });
    const publicStatsFn = createFunction('PublicStats', 'public-stats.ts', {});
    const adminStatsFn = createFunction('AdminStats', 'admin-stats.ts', {
      ADMIN_TOKEN_SECRET_ARN: adminToken.secretArn,
    });

    table.grantReadWriteData(collectFn);
    table.grantReadData(publicStatsFn);
    table.grantReadData(adminStatsFn);
    adminToken.grantRead(adminStatsFn);

    const api = new HttpApi(this, 'Api', {
      description: 'Portfolio analytics collector and stats',
      corsPreflight: {
        allowOrigins: props.siteOrigins,
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST],
        allowHeaders: ['content-type', 'x-admin-token'],
        maxAge: Duration.days(1),
      },
    });

    const routes = [
      ...api.addRoutes({ path: '/collect', methods: [HttpMethod.POST], integration: new HttpLambdaIntegration('CollectIntegration', collectFn) }),
      ...api.addRoutes({ path: '/stats/public', methods: [HttpMethod.GET], integration: new HttpLambdaIntegration('PublicStatsIntegration', publicStatsFn) }),
      ...api.addRoutes({ path: '/stats', methods: [HttpMethod.GET], integration: new HttpLambdaIntegration('AdminStatsIntegration', adminStatsFn) }),
    ];

    const stage = api.defaultStage?.node.defaultChild as CfnStage;
    // RouteSettings name routes by key, and CloudFormation rejects keys that don't exist yet
    stage.node.addDependency(...routes);
    stage.defaultRouteSettings = { throttlingRateLimit: PUBLIC_RATE_PER_SECOND, throttlingBurstLimit: PUBLIC_BURST };
    // RouteSettings is a raw JSON map in CloudFormation, so keys must already be PascalCase
    stage.routeSettings = {
      'GET /stats': { ThrottlingRateLimit: ADMIN_RATE_PER_SECOND, ThrottlingBurstLimit: ADMIN_BURST },
    };

    // CloudFront sits in front of the API only to attach viewer location headers
    const forwardToApi = new cloudfront.OriginRequestPolicy(this, 'ForwardToApi', {
      comment: 'Viewer location, UA and CORS headers for analytics',
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
        'origin',
        'user-agent',
        'x-admin-token',
        'access-control-request-method',
        'access-control-request-headers',
        'CloudFront-Viewer-Country',
        'CloudFront-Viewer-Country-Region-Name',
        'CloudFront-Viewer-City',
      ),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
    });

    const publicStatsCache = new cloudfront.CachePolicy(this, 'PublicStatsCache', {
      comment: 'Visitor counter: honour the 60s Cache-Control from the origin, vary by Origin for CORS',
      minTtl: Duration.seconds(0),
      defaultTtl: Duration.seconds(60),
      maxTtl: Duration.minutes(5),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('origin'),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
    });

    const apiOrigin = new HttpOrigin(`${api.apiId}.execute-api.${this.region}.amazonaws.com`);

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'Portfolio analytics API',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      defaultBehavior: {
        origin: apiOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: forwardToApi,
      },
      additionalBehaviors: {
        '/stats/public': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: publicStatsCache,
          originRequestPolicy: forwardToApi,
        },
      },
    });

    new CfnOutput(this, 'AnalyticsUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Set this as PUBLIC_ANALYTICS_URL for the site build',
    });
    new CfnOutput(this, 'AdminTokenCommand', {
      value: `aws secretsmanager get-secret-value --secret-id ${adminToken.secretName} --query SecretString --output text --profile dongik2`,
      description: 'Prints the /admin token',
    });
    new CfnOutput(this, 'TableName', { value: table.tableName });
  }
}
