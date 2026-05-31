import { extractRequirementIds, type ParsedWorkItem } from "@doorframe/parsers";
import type { ParseResult, RequirementIdPattern } from "@doorframe/core";
import { basicAuthHeader, getJson, defaultHttpClient, type HttpClient } from "./http";

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  jql: string;
  maxResults?: number;
}

interface JiraIssue {
  key: string;
  fields?: {
    summary?: string;
    description?: unknown;
    status?: { name?: string };
    issuetype?: { name?: string };
    assignee?: { displayName?: string };
  };
}

interface JiraSearchResponse {
  issues?: JiraIssue[];
}

/** Read Jira's Atlassian-Document-Format or string description into plain text. */
function descriptionText(description: unknown): string {
  if (!description) {
    return "";
  }
  if (typeof description === "string") {
    return description;
  }
  // Atlassian Document Format: recursively collect any `text` nodes.
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const record = node as Record<string, unknown>;
    if (typeof record.text === "string") {
      out.push(record.text);
    }
    Object.values(record).forEach(walk);
  };
  walk(description);
  return out.join(" ");
}

/** Resolve Jira credentials from the environment (local-first). */
export function jiraConfigFromEnv(jql?: string): JiraConfig | null {
  const baseUrl = process.env.DOORFRAME_JIRA_BASE_URL;
  const email = process.env.DOORFRAME_JIRA_EMAIL;
  const apiToken = process.env.DOORFRAME_JIRA_API_TOKEN;
  if (!baseUrl || !email || !apiToken) {
    return null;
  }
  return { baseUrl, email, apiToken, jql: jql ?? process.env.DOORFRAME_JIRA_JQL ?? "" };
}

/**
 * Fetch Jira issues via the REST API and map them to Doorframe work items,
 * extracting requirement IDs from the summary and description.
 */
export async function fetchJiraIssues(
  config: JiraConfig,
  http: HttpClient = defaultHttpClient,
  patterns?: RequirementIdPattern[]
): Promise<ParseResult<ParsedWorkItem>> {
  const errors: string[] = [];
  const records: ParsedWorkItem[] = [];

  try {
    const url = `${config.baseUrl.replace(/\/$/, "")}/rest/api/3/search?jql=${encodeURIComponent(
      config.jql
    )}&maxResults=${config.maxResults ?? 100}&fields=summary,description,status,issuetype,assignee`;
    const data = await getJson<JiraSearchResponse>(http, url, {
      Authorization: basicAuthHeader(config.email, config.apiToken),
      Accept: "application/json"
    });

    (data.issues ?? []).forEach((issue) => {
      const summary = issue.fields?.summary ?? issue.key;
      const description = descriptionText(issue.fields?.description);
      const requirementIds = extractRequirementIds(`${summary}\n${description}`, patterns);

      records.push({
        externalId: issue.key.toUpperCase(),
        title: summary,
        description,
        status: issue.fields?.status?.name,
        type: issue.fields?.issuetype?.name,
        assignee: issue.fields?.assignee?.displayName,
        source: "jira-api",
        rawAttributes: issue as unknown as Record<string, unknown>,
        requirementIds
      });
    });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return { records, errors };
}
