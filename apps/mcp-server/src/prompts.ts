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
}
