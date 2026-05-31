import { parseJUnitXml, type ParsedTestCase } from "@doorframe/parsers";
import type { ParseResult, RequirementIdPattern } from "@doorframe/core";
import { getJson, defaultHttpClient, type HttpClient } from "./http";

export interface GithubConfig {
  owner: string;
  repo: string;
  token: string;
  /** Raw JUnit XML retrieved out-of-band (e.g. a downloaded artifact). */
  junitXml?: string;
  /** Optional run id, used only for messaging when no XML is supplied. */
  runId?: string | number;
  apiBaseUrl?: string;
}

export function githubConfigFromEnv(owner?: string, repo?: string): GithubConfig | null {
  const token = process.env.DOORFRAME_GITHUB_TOKEN;
  const resolvedOwner = owner ?? process.env.DOORFRAME_GITHUB_OWNER;
  const resolvedRepo = repo ?? process.env.DOORFRAME_GITHUB_REPO;
  if (!token || !resolvedOwner || !resolvedRepo) {
    return null;
  }
  return { owner: resolvedOwner, repo: resolvedRepo, token, apiBaseUrl: process.env.DOORFRAME_GITHUB_API_URL };
}

interface ArtifactList {
  artifacts?: { id: number; name: string }[];
}

/**
 * Import GitHub Actions test results as Doorframe test cases.
 *
 * Because Actions artifacts are zipped, the pragmatic path is to provide the
 * extracted JUnit XML directly via {@link GithubConfig.junitXml}; that XML is
 * fed straight into the shared JUnit parser. When `junitXml` is omitted we at
 * least verify the run's artifacts are reachable and report what we found.
 */
export async function fetchGithubJunit(
  config: GithubConfig,
  http: HttpClient = defaultHttpClient,
  patterns?: RequirementIdPattern[]
): Promise<ParseResult<ParsedTestCase>> {
  if (config.junitXml) {
    return parseJUnitXml(config.junitXml, patterns);
  }

  const errors: string[] = [];
  try {
    const base = (config.apiBaseUrl ?? "https://api.github.com").replace(/\/$/, "");
    const url = config.runId
      ? `${base}/repos/${config.owner}/${config.repo}/actions/runs/${config.runId}/artifacts`
      : `${base}/repos/${config.owner}/${config.repo}/actions/artifacts`;
    const data = await getJson<ArtifactList>(http, url, {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json"
    });
    const names = (data.artifacts ?? []).map((artifact) => artifact.name).join(", ");
    errors.push(
      `Provide extracted JUnit XML via junitXml to import. Available artifacts: ${names || "none"}.`
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return { records: [], errors };
}
