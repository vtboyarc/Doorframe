import { z } from "zod";

export const rawAttributesSchema = z.record(z.string(), z.unknown()).default({});

export const requirementInputSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  text: z.string().default(""),
  source: z.string().min(1),
  type: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  verificationMethod: z.string().optional(),
  parentExternalId: z.string().optional(),
  rawAttributes: rawAttributesSchema.optional()
});

export const workItemInputSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  assignee: z.string().optional(),
  source: z.string().min(1),
  rawAttributes: rawAttributesSchema.optional()
});

export const testCaseInputSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
  classname: z.string().optional(),
  status: z.enum(["passed", "failed", "skipped"]),
  duration: z.number().optional(),
  failureMessage: z.string().optional(),
  source: z.string().min(1),
  rawAttributes: rawAttributesSchema.optional()
});

export const traceLinkInputSchema = z.object({
  sourceType: z.enum(["requirement", "workItem", "testCase"]),
  sourceId: z.string().min(1),
  targetType: z.enum(["requirement", "workItem", "testCase"]),
  targetId: z.string().min(1),
  linkType: z.enum(["implements", "verifies", "references", "parent", "derived"]),
  confidence: z.number().min(0).max(1),
  source: z.string().min(1)
});

export const findingInputSchema = z.object({
  severity: z.enum(["info", "warning", "error"]),
  category: z.enum([
    "missing_verification",
    "missing_work_trace",
    "weak_wording",
    "multi_requirement",
    "non_verifiable",
    "duplicate_candidate",
    "stale_link",
    "closed_work_without_verification"
  ]),
  title: z.string().min(1),
  description: z.string().min(1),
  entityType: z.enum(["requirement", "workItem", "testCase"]),
  entityId: z.string().min(1),
  recommendation: z.string().optional()
});
