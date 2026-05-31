import {
  asArray,
  type ParseResult,
  type RequirementIdPattern,
  testCaseInputSchema
} from "@doorframe/core";
import { XMLParser } from "fast-xml-parser";
import { extractRequirementIds } from "./ids";
import type { ParsedTestCase } from "./types";

type XmlNode = Record<string, unknown>;

function nodeText(value: unknown): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null) {
    const node = value as XmlNode;
    return String(node["@_message"] ?? node["#text"] ?? "");
  }

  return String(value);
}

function testcaseStatus(testcase: XmlNode): ParsedTestCase["status"] {
  if (testcase.skipped) {
    return "skipped";
  }

  if (testcase.failure || testcase.error) {
    return "failed";
  }

  return "passed";
}

function collectSuites(suite: XmlNode): XmlNode[] {
  const childSuites = asArray(suite.testsuite as XmlNode | XmlNode[] | undefined);
  return [suite, ...childSuites.flatMap(collectSuites)];
}

export function parseJUnitXml(
  input: string,
  patterns?: RequirementIdPattern[]
): ParseResult<ParsedTestCase> {
  const parser = new XMLParser({
    attributeNamePrefix: "@_",
    ignoreAttributes: false,
    textNodeName: "#text"
  });
  const document = parser.parse(input) as XmlNode;
  const rootSuites = [
    ...asArray(document.testsuite as XmlNode | XmlNode[] | undefined),
    ...asArray((document.testsuites as XmlNode | undefined)?.testsuite as XmlNode | XmlNode[] | undefined)
  ];
  const suites = rootSuites.flatMap(collectSuites);
  const records: ParsedTestCase[] = [];
  const errors: string[] = [];

  suites.forEach((suite) => {
    const suiteName = String(suite["@_name"] ?? "");
    const testcases = asArray(suite.testcase as XmlNode | XmlNode[] | undefined);

    testcases.forEach((testcase, index) => {
      const name = String(testcase["@_name"] ?? `testcase-${index + 1}`);
      const classname = String(testcase["@_classname"] ?? suiteName);
      const failureMessage = nodeText(testcase.failure) || nodeText(testcase.error) || undefined;
      const externalId = `${classname}.${name}`.replace(/\s+/g, " ").trim();
      const duration = Number(testcase["@_time"] ?? 0);

      const candidate: ParsedTestCase = {
        externalId,
        name,
        classname,
        status: testcaseStatus(testcase),
        duration: Number.isFinite(duration) ? duration : undefined,
        failureMessage,
        source: "junit-xml",
        rawAttributes: testcase,
        requirementIds: extractRequirementIds(`${name}\n${classname}\n${failureMessage ?? ""}`, patterns)
      };

      const validation = testCaseInputSchema.safeParse(candidate);
      if (!validation.success) {
        errors.push(
          `${externalId}: ${validation.error.issues.map((issue) => issue.message).join(", ")}`
        );
        return;
      }

      records.push(candidate);
    });
  });

  return { records, errors };
}
