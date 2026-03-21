-- DevOps Agent Schema
-- Run this script to create all tables for the AI DevOps Agent

-- ============================================================
-- MONITORED PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.monitored_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vercel_project_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  github_repo TEXT,
  github_owner TEXT,
  github_branch TEXT DEFAULT 'main',
  framework TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.monitored_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.monitored_projects FOR ALL USING (true);

-- ============================================================
-- DEPLOYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vercel_deployment_id TEXT NOT NULL UNIQUE,
  project_id UUID REFERENCES public.monitored_projects(id) ON DELETE CASCADE,
  vercel_project_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  url TEXT,
  status TEXT NOT NULL CHECK (status IN ('building', 'ready', 'error', 'canceled', 'queued')),
  target TEXT CHECK (target IN ('production', 'preview')),
  branch TEXT,
  commit_sha TEXT,
  commit_message TEXT,
  creator_name TEXT,
  build_duration_ms INTEGER,
  error_message TEXT,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.deployments FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON public.deployments(vercel_project_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON public.deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_created_at ON public.deployments(created_at DESC);

-- ============================================================
-- INCIDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.monitored_projects(id) ON DELETE CASCADE,
  vercel_project_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  category TEXT NOT NULL DEFAULT 'deployment' CHECK (category IN ('deployment', 'security', 'performance', 'availability', 'configuration', 'code')),
  root_cause TEXT,
  resolution TEXT,
  agent_analysis TEXT,
  related_deployment_id UUID REFERENCES public.deployments(id) ON DELETE SET NULL,
  slack_notified BOOLEAN DEFAULT FALSE,
  pr_raised BOOLEAN DEFAULT FALSE,
  pr_url TEXT,
  pr_number INTEGER,
  meta JSONB DEFAULT '{}',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.incidents FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON public.incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON public.incidents(created_at DESC);

-- ============================================================
-- PULL REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pull_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
  github_pr_number INTEGER NOT NULL,
  github_pr_url TEXT NOT NULL,
  github_repo TEXT NOT NULL,
  github_owner TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  branch TEXT NOT NULL,
  base_branch TEXT DEFAULT 'main',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'merged', 'closed', 'draft')),
  files_changed JSONB DEFAULT '[]',
  agent_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pull_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.pull_requests FOR ALL USING (true);

-- ============================================================
-- AGENT CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  context TEXT DEFAULT 'general' CHECK (context IN ('general', 'deployment', 'security', 'incident', 'github')),
  related_project_id UUID REFERENCES public.monitored_projects(id) ON DELETE SET NULL,
  related_incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.agent_conversations FOR ALL USING (true);

-- ============================================================
-- AGENT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  tool_calls JSONB DEFAULT '[]',
  tool_results JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.agent_messages FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_id ON public.agent_messages(conversation_id);

-- ============================================================
-- SECURITY EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.monitored_projects(id) ON DELETE CASCADE,
  vercel_project_id TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  title TEXT NOT NULL,
  description TEXT,
  source TEXT,
  raw_data JSONB DEFAULT '{}',
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.security_events FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at DESC);

-- ============================================================
-- SEED: Demo monitored project
-- ============================================================
INSERT INTO public.monitored_projects (vercel_project_id, name, github_repo, github_owner, github_branch, framework, status)
VALUES
  ('prj_demo_001', 'my-nextjs-app', 'my-nextjs-app', 'myorg', 'main', 'nextjs', 'active'),
  ('prj_demo_002', 'api-service', 'api-service', 'myorg', 'main', 'nodejs', 'active')
ON CONFLICT (vercel_project_id) DO NOTHING;
