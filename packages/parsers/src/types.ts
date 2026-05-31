import type { RequirementInput, TestCaseInput, WorkItemInput } from "@doorframe/core";

export interface RequirementsCsvMapping {
  requirementId: string;
  title?: string;
  text: string;
  status?: string;
  type?: string;
  priority?: string;
  verificationMethod?: string;
  parentId?: string;
}

export interface JiraCsvMapping {
  issueKey: string;
  summary?: string;
  description?: string;
  status?: string;
  issueType?: string;
  assignee?: string;
  requirementIds?: string;
}

export interface ParsedRequirement extends RequirementInput {}

export interface ParsedWorkItem extends WorkItemInput {
  requirementIds: string[];
}

export interface ParsedTestCase extends TestCaseInput {
  requirementIds: string[];
}
