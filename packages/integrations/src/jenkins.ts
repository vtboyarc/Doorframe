import { extractRequirementIds, type ParsedTestCase } from "@doorframe/parsers";
import type { ParseResult, RequirementIdPattern, TestStatus } from "@doorframe/core";
import { basicAuthHeader, getJson, defaultHttpClient, type HttpClient } from "./http";

export interface JenkinsConfig {
  baseUrl: string;
  job: string;
  build: string | number;
  user?: string;
  apiToken?: string;
}

interface JenkinsCase {
  className?: string;
  name?: string;
  status?: string;
  duration?: number;
  errorDetails?: string;
  errorStackTrace?: string;
}

interface JenkinsSuite {
  cases?: JenkinsCase[];
}

interface JenkinsTestReport {
  suites?: JenkinsSuite[];
}

function mapStatus(status: string | undefined): TestStatus {
  const normalized = (status ?? "").toUpperCase();
  if (normalized === "PASSED" || normalized === "FIXED") {
    return "passed";
  }
  if (normalized === "SKIPPED") {
    return "skipped";
  }
  return "failed";
}

export function jenkinsConfigFromEnv(job?: string, build?: string): JenkinsConfig | null {
  const baseUrl = process.env.DOORFRAME_JENKINS_BASE_URL;
  const resolvedJob = job ?? process.env.DOORFRAME_JENKINS_JOB;
  const resolvedBuild = build ?? process.env.DOORFRAME_JENKINS_BUILD ?? "lastCompletedBuild";
  if (!baseUrl || !resolvedJob) {
    return null;
  }
  return {
    baseUrl,
    job: resolvedJob,
    build: resolvedBuild,
    user: process.env.DOORFRAME_JENKINS_USER,
    apiToken: process.env.DOORFRAME_JENKINS_API_TOKEN
  };
}

/**
 * Fetch a Jenkins build's JUnit test report (`/testReport/api/json`) and map it
 * to Doorframe test cases, extracting linked requirement IDs from case names.
 */
export async function fetchJenkinsTestReport(
  config: JenkinsConfig,
  http: HttpClient = defaultHttpClient,
  patterns?: RequirementIdPattern[]
): Promise<ParseResult<ParsedTestCase>> {
  const errors: string[] = [];
  const records: ParsedTestCase[] = [];

  try {
    const url = `${config.baseUrl.replace(/\/$/, "")}/job/${encodeURIComponent(config.job)}/${
      config.build
    }/testReport/api/json`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (config.user && config.apiToken) {
      headers.Authorization = basicAuthHeader(config.user, config.apiToken);
    }

    const data = await getJson<JenkinsTestReport>(http, url, headers);
    (data.suites ?? []).forEach((suite) => {
      (suite.cases ?? []).forEach((testCase) => {
        const name = testCase.name ?? "unnamed";
        const classname = testCase.className ?? "";
        const failureMessage = testCase.errorDetails || testCase.errorStackTrace || undefined;
        const externalId = `${classname}.${name}`.replace(/\s+/g, " ").trim();

        records.push({
          externalId,
          name,
          classname,
          status: mapStatus(testCase.status),
          duration: typeof testCase.duration === "number" ? testCase.duration : undefined,
          failureMessage,
          source: "jenkins",
          rawAttributes: testCase as unknown as Record<string, unknown>,
          requirementIds: extractRequirementIds(`${name}\n${classname}\n${failureMessage ?? ""}`, patterns)
        });
      });
    });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return { records, errors };
}
