import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

function promptMessage(text: string) {
  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text
        }
      }
    ]
  };
}

export function registerDoorframePrompts(server: McpServer): void {
  server.registerPrompt(
    "review_prep",
    {
      title: "Review prep",
      description: "Prepare for an engineering review using the current Doorframe project.",
      argsSchema: {
        reviewType: z.string()
      }
    },
    (args) =>
      promptMessage(
        `Use Doorframe tools to inspect the project summary, traceability gaps, and findings. Produce a concise review-prep brief for ${args.reviewType}. Include the highest-risk gaps, requirements that need attention, and suggested questions to ask in the review. Do not make claims beyond the data available in Doorframe.`
      )
  );

  server.registerPrompt(
    "requirement_quality_review",
    {
      title: "Requirement quality review",
      description: "Review requirement quality issues in the current Doorframe project.",
      argsSchema: {
        focus: z.string().optional()
      }
    },
    (args) =>
      promptMessage(
        `Use Doorframe tools to find weak, vague, duplicate, non-verifiable, or multi-shall requirements${
          args.focus ? ` with focus on ${args.focus}` : ""
        }. Summarize the main quality issues and provide examples from the project. Do not rewrite requirements unless the user asks.`
      )
  );

  server.registerPrompt(
    "verification_gap_review",
    {
      title: "Verification gap review",
      description: "Review missing verification evidence.",
      argsSchema: {
        severity: z.string().optional()
      }
    },
    (args) =>
      promptMessage(
        `Use Doorframe tools to find requirements with no linked tests, failed linked tests, skipped tests, or closed work without passing verification${
          args.severity ? ` at ${args.severity} severity` : ""
        }. Summarize what should be checked before the next review.`
      )
  );

  server.registerPrompt(
    "test_readiness_review_prep",
    {
      title: "Test readiness review prep",
      description: "Prepare for test readiness review using Doorframe project facts.",
      argsSchema: {}
    },
    () =>
      promptMessage(
        "Use Doorframe tools to inspect project summary, baseline diff, stale trace candidates, missing verification, failed tests, and closed work without passing tests. Produce a concise review-prep brief. Do not make claims beyond Doorframe data."
      )
  );

  server.registerPrompt(
    "baseline_change_review",
    {
      title: "Baseline change review",
      description: "Review added, deleted, and changed requirements between baselines.",
      argsSchema: {}
    },
    () =>
      promptMessage(
        "Use Doorframe tools to review added, deleted, and changed requirements between baselines. Pay special attention to numeric threshold changes, verification method changes, and stale trace candidates."
      )
  );

  server.registerPrompt(
    "stale_trace_review",
    {
      title: "Stale trace review",
      description: "Review trace links that may be stale after requirement changes.",
      argsSchema: {}
    },
    () =>
      promptMessage(
        "Use Doorframe tools to find trace links that may be stale after requirement changes. Explain why each candidate may be stale and what a systems engineer or test lead should verify."
      )
  );

  server.registerPrompt(
    "requirements_review_prep",
    {
      title: "Requirements review prep",
      description: "Prepare for requirements review using Doorframe project facts.",
      argsSchema: {}
    },
    () =>
      promptMessage(
        "Use Doorframe tools to inspect weak wording, duplicate candidates, missing work links, missing verification methods, and changed requirements."
      )
  );

  server.registerPrompt(
    "pi_planning_prep",
    {
      title: "PI planning prep",
      description: "Prepare traceability facts for PI planning.",
      argsSchema: {}
    },
    () =>
      promptMessage(
        "Use Doorframe tools to identify requirements with missing work items, changed requirements without updated work, and high-concern traceability gaps."
      )
  );

  server.registerPrompt(
    "audit_prep",
    {
      title: "Audit prep",
      description: "Summarize traceability and verification gaps for internal review or audit prep.",
      argsSchema: {}
    },
    () =>
      promptMessage(
        "Use Doorframe tools to summarize traceability and verification gaps that may matter during an audit or internal review. Do not claim compliance status."
      )
  );
}
