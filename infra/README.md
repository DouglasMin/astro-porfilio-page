# Portfolio analytics

Cookie-free visitor analytics for the site: a collector, a public visitor counter, and the `/admin` dashboard API.

```
browser ── /collect ─▶ CloudFront (adds country/city) ─▶ HTTP API (throttled) ─▶ Lambda ─▶ DynamoDB
footer  ◀─ /stats/public (cached 60s)
/admin  ◀─ /stats?from=YYYY-MM-DD&to=YYYY-MM-DD  (x-admin-token header)
```

No IP addresses are stored. Visitors are identified by a random id in `localStorage`; raw events expire after about 13 months.

## Commands

```bash
npm install
npm test          # unit + CDK assertion tests
npm run local     # real handlers on an in-memory store at http://localhost:8787 (token: local-admin-token)
npm run diff      # compare with what is deployed (profile dongik2)
npm run deploy    # deploy (profile dongik2)
```

The first deploy into an account needs `npx cdk bootstrap --profile dongik2` once.

## After deploying

1. Copy the `AnalyticsUrl` output and set it as `PUBLIC_ANALYTICS_URL`:
   - locally in the site's `.env`
   - in GitHub: Settings → Secrets and variables → Actions → **Variables** → `PUBLIC_ANALYTICS_URL`
2. Print the admin token with the `AdminTokenCommand` output and use it on `/admin`.
3. Allowed browser origins live in `cdk.json` (`siteOrigins`); redeploy after changing them.
