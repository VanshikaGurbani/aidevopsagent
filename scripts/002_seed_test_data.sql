-- ============================================================
-- SEED: Realistic test data for all dashboard pages
-- ============================================================

-- Deployments
INSERT INTO public.deployments (vercel_deployment_id, vercel_project_id, project_name, url, status, target, branch, commit_sha, commit_message, creator_name, build_duration_ms, error_message)
VALUES
  ('dpl_test_001', 'prj_demo_001', 'my-nextjs-app', 'https://my-nextjs-app.vercel.app', 'ready',      'production', 'main',    'a1b2c3d', 'feat: add user dashboard',          'sarah@acme.com', 42300, NULL),
  ('dpl_test_002', 'prj_demo_001', 'my-nextjs-app', 'https://preview-abc.vercel.app',   'ready',      'preview',    'feat/nav', 'e4f5g6h', 'feat: redesign navigation bar',      'tom@acme.com',   31200, NULL),
  ('dpl_test_003', 'prj_demo_001', 'my-nextjs-app', NULL,                               'error',      'production', 'main',    'i7j8k9l', 'fix: update auth middleware',        'sarah@acme.com', 18700, 'Module not found: @/lib/auth'),
  ('dpl_test_004', 'prj_demo_002', 'api-service',   'https://api-service.vercel.app',   'ready',      'production', 'main',    'm1n2o3p', 'chore: upgrade dependencies',        'dev@acme.com',   55100, NULL),
  ('dpl_test_005', 'prj_demo_002', 'api-service',   NULL,                               'building',   'preview',    'fix/cors', 'q4r5s6t', 'fix: resolve CORS header issue',     'tom@acme.com',   NULL,  NULL),
  ('dpl_test_006', 'prj_demo_001', 'my-nextjs-app', NULL,                               'canceled',   'preview',    'wip/exp',  'u7v8w9x', 'wip: experimental feature flag',    'sarah@acme.com', 5400,  NULL)
ON CONFLICT (vercel_deployment_id) DO NOTHING;

-- Incidents
INSERT INTO public.incidents (vercel_project_id, title, description, severity, status, category, root_cause, agent_analysis, slack_notified, pr_raised, pr_url, pr_number)
VALUES
  ('prj_demo_001', 'Production deployment failed — missing module', 'Deployment dpl_test_003 failed with "Module not found: @/lib/auth". Production is running the previous build.',
   'critical', 'investigating', 'deployment',
   'The import path @/lib/auth was renamed to @/lib/auth/client in a recent refactor but the middleware was not updated.',
   'Root cause identified: auth middleware (middleware.ts line 12) still imports from the old path. Fix: update import to `@/lib/auth/client`. A branch and PR have been prepared.',
   true, true, 'https://github.com/myorg/my-nextjs-app/pull/42', 42),

  ('prj_demo_001', 'CORS misconfiguration detected on API routes', 'Security scan detected that /api/* routes are returning wildcard Access-Control-Allow-Origin headers in production.',
   'high', 'open', 'security',
   NULL,
   'The next.config.mjs headers() function sets Access-Control-Allow-Origin: * for all routes. This should be restricted to known origins.',
   false, false, NULL, NULL),

  ('prj_demo_002', 'Elevated 5xx error rate on /api/webhooks', 'Error rate on the /api/webhooks endpoint has exceeded 3% over the last 15 minutes. Likely caused by malformed payload validation.',
   'high', 'open', 'availability',
   NULL,
   'Webhook handler lacks input schema validation. Any malformed JSON payload causes an unhandled exception and 500 response.',
   true, false, NULL, NULL),

  ('prj_demo_002', 'API service CORS headers patched', 'CORS configuration was reviewed and updated to restrict allowed origins to production domain only.',
   'low', 'resolved', 'security',
   'Wildcard CORS origin set during local development was accidentally committed.',
   'Resolved by updating next.config.mjs to whitelist only https://my-nextjs-app.vercel.app.',
   true, true, 'https://github.com/myorg/api-service/pull/38', 38),

  ('prj_demo_001', 'Missing environment variable in preview deployments', 'NEXT_PUBLIC_ANALYTICS_ID is not set in preview environments causing analytics to silently fail.',
   'medium', 'open', 'configuration',
   NULL,
   'The variable is set in production but not in preview scope. This causes a silent failure in the analytics module.',
   false, false, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Pull Requests (linked to incident 1 and 4)
WITH inc1 AS (SELECT id FROM public.incidents WHERE title LIKE 'Production deployment failed%' LIMIT 1),
     inc4 AS (SELECT id FROM public.incidents WHERE title LIKE 'API service CORS%' LIMIT 1)
INSERT INTO public.pull_requests (incident_id, github_pr_number, github_pr_url, github_repo, github_owner, title, body, branch, base_branch, status, files_changed, agent_notes)
SELECT
  inc1.id, 42,
  'https://github.com/myorg/my-nextjs-app/pull/42',
  'my-nextjs-app', 'myorg',
  'fix: update auth middleware import path',
  '## Agent-Generated Fix\n\nThis PR was automatically created by the DevOps Agent.\n\n**Root Cause:** `middleware.ts` was importing from `@/lib/auth` which was renamed to `@/lib/auth/client`.\n\n**Fix:** Updated import path on line 12.\n\n**Tested:** Build passes locally, deployment should succeed.',
  'fix/agent-auth-middleware-import',
  'main', 'open',
  '[{"path": "middleware.ts", "additions": 1, "deletions": 1}]',
  'Auto-fix generated after analysing deployment failure logs. Import path mismatch identified on line 12.'
FROM inc1
UNION ALL
SELECT
  inc4.id, 38,
  'https://github.com/myorg/api-service/pull/38',
  'api-service', 'myorg',
  'fix: restrict CORS allowed origins to production domain',
  '## Agent-Generated Fix\n\nThis PR was automatically created by the DevOps Agent.\n\n**Root Cause:** Wildcard CORS (`*`) was set in `next.config.mjs`.\n\n**Fix:** Restricted `Access-Control-Allow-Origin` to `https://my-nextjs-app.vercel.app`.',
  'fix/agent-cors-allowed-origins',
  'main', 'merged',
  '[{"path": "next.config.mjs", "additions": 3, "deletions": 1}]',
  'Security scan detected wildcard CORS. Fix applied and merged — production is now secure.'
FROM inc4
ON CONFLICT DO NOTHING;

-- Security Events
INSERT INTO public.security_events (vercel_project_id, event_type, severity, title, description, source, acknowledged)
VALUES
  ('prj_demo_001', 'cors_misconfiguration', 'high',    'Wildcard CORS header on API routes',              'Access-Control-Allow-Origin: * detected on /api routes in production scan.', 'security-scanner', false),
  ('prj_demo_001', 'env_var_missing',        'medium',  'Missing NEXT_PUBLIC_ANALYTICS_ID in preview',     'Analytics variable absent from preview environment scope.',                  'env-scanner',      false),
  ('prj_demo_002', 'unhandled_exception',    'high',    'Unhandled exception on /api/webhooks',            'Malformed webhook payloads causing 500 responses. No schema validation.',    'error-monitor',    false),
  ('prj_demo_001', 'dependency_outdated',    'low',     'next@14.1.0 has known CVE',                       'next package is 3 minor versions behind. CVE-2024-34351 patched in 14.2.3.','dependency-scan',  true),
  ('prj_demo_002', 'deployment_anomaly',     'info',    'Unusual deployment frequency detected',           'api-service has been deployed 8 times in 24 hours — above baseline of 2.',   'deployment-monitor', true),
  ('prj_demo_001', 'header_missing',         'medium',  'X-Frame-Options header not set',                  'Clickjacking protection header missing from production deployment.',          'security-scanner', false),
  ('prj_demo_002', 'cors_misconfiguration',  'high',    'CORS wildcard resolved — PR #38 merged',          'Wildcard CORS issue resolved after agent-generated PR was merged.',           'security-scanner', true)
ON CONFLICT DO NOTHING;
