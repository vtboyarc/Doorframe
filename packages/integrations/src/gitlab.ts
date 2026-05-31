import { parseJUnitXml, type ParsedTestCase } from "@doorframe/parsers";
import type { ParseResult, RequirementIdPattern } from "@doorframe/core";
import { defaultHttpClient, type HttpClient } from "./http";

export interface GitlabConfig {
  projectId: string | number;
  jobId: string | number;
  token: string;
  baseUrl?: string;
  /** Artifact path inside the job archive (defaults to a common JUnit path). */
  artifactPath?: string;
}

export function gitlabConfigFromEnv(projectId?: string, jobId?: string): GitlabConfig | null {
  const token = process.env.DOORFRAME_GITLAB_TOKEN;
  const resolvedProject = projectId ?? process.env.DOORFRAME_GITLAB_PROJECT_ID;
  const resolvedJob = jobId ?? process.env.DOORFRAME_GITLAB_JOB_ID;
  if (!token || !resolvedProject || !resolvedJob) {
    return null;
  }
  return {
    projectId: resolvedProject,
    jobId: resolvedJob,
    token,
    baseUrl: process.env.DOORFRAME_GITLAB_BASE_URL,
    artifactPath: process.env.DOORFRAME_GITLAB_ARTIFACT_PATH
  };
}

/**
 * Fetch a single JUnit artifact from a GitLab CI job and parse it into Doorframe
 * test cases via the shared JUnit parser.
 */
export async function fetchGitlabJunit(
  config: GitlabConfig,
  http: HttpClient = defaultHttpClient,
  patterns?: RequirementIdPattern[]
): Promise<ParseResult<ParsedTestCase>> {
  const errors: string[] = [];
  try {
    const base = (config.baseUrl ?? "https://gitlab.com/api/v4").replace(/\/$/, "");
    const artifactPath = config.artifactPath ?? "junit.xml";
    const url = `${base}/projects/${encodeURIComponent(String(config.projectId))}/jobs/${
      config.jobId
    }/artifacts/${artifactPath}`;
    const response = await http(url, { method: "GET", headers: { "PRIVATE-TOKEN": config.token } });
    const body = await response.text();
    if (!response.ok) {
      errors.push(`GitLab artifact request failed with status ${response.status}.`);
      return { records: [], errors };
    }
    return parseJUnitXml(body, patterns);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return { records: [], errors };
}
