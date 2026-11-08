import {
  asArray,
  type ParseResult,
  type RequirementIdPattern,
  testCaseInputSchema
} from "@doorframe/core";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { extractRequirementIds } from "./ids";
import type { ParsedTestCase } from "./types";

type XmlNode = Record<string, unknown>;

/** Preserve message attributes and bodies, including repeated result elements. */
function nodeText(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(nodeText).filter(Boolean).join("\n");
  }

  if (typeof value === "object" && value !== null) {
    const node = value as XmlNode;
    return [node["@_message"], node["#text"]].map(nodeText).filter(Boolean).join("\n");
  }

  return String(value);
}

/**
 * A result element counts when it is present at all. The XML parser turns an
 * empty element such as `<skipped/>` into "" and `<failure>0</failure>` into 0,
 * so presence, not truthiness, decides the status.
 */
function hasElement(testcase: XmlNode, name: "skipped" | "error" | "failure"): boolean {
  return testcase[name] !== undefined;
}

function testcaseStatus(testcase: XmlNode): ParsedTestCase["status"] {
  if (hasElement(testcase, "skipped")) {
    return "skipped";
  }

  if (hasElement(testcase, "error")) {
    return "errored";
  }

  if (hasElement(testcase, "failure")) {
    return "failed";
  }

  return "passed";
}

interface SuiteContext {
  suite: XmlNode;
  names: string[];
}

function collectSuites(suite: XmlNode, parentNames: string[] = []): SuiteContext[] {
  const names = [...parentNames, String(suite["@_name"] ?? "")];
  const childSuites = asArray(suite.testsuite as XmlNode | XmlNode[] | undefined);
  return [{ suite, names }, ...childSuites.flatMap((child) => collectSuites(child, names))];
}

export function parseJUnitXml(
  input: string,
  patterns?: RequirementIdPattern[]
): ParseResult<ParsedTestCase> {
  const validation = XMLValidator.validate(input);
  if (validation !== true) {
    return {
      records: [],
      errors: [`JUnit XML parse failed at line ${validation.err.line}: ${validation.err.msg}`]
    };
  }

  const parser = new XMLParser({
    attributeNamePrefix: "@_",
    ignoreAttributes: false,
    textNodeName: "#text"
  });
  let document: XmlNode;
  try {
    document = parser.parse(input) as XmlNode;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid XML.";
    return { records: [], errors: [`JUnit XML parse failed: ${message}`] };
  }

  if (document.testsuite === undefined && document.testsuites === undefined) {
    return { records: [], errors: ["Expected a JUnit <testsuite> or <testsuites> root element."] };
  }

  const rootSuites = [
    ...asArray(document.testsuite as XmlNode | XmlNode[] | undefined),
    ...asArray((document.testsuites as XmlNode | undefined)?.testsuite as XmlNode | XmlNode[] | undefined)
  ];
  const suites = rootSuites.flatMap((suite) => collectSuites(suite));
  const records: ParsedTestCase[] = [];
  const errors: string[] = [];

  suites.forEach(({ suite, names }) => {
    const suiteName = String(suite["@_name"] ?? "");
    const testcases = asArray(suite.testcase as XmlNode | XmlNode[] | undefined);

    testcases.forEach((testcase, index) => {
      const name = String(testcase["@_name"] ?? `testcase-${index + 1}`);
      const classname = String(testcase["@_classname"] ?? suiteName);
      const failureMessage = [nodeText(testcase.failure), nodeText(testcase.error)].filter(Boolean).join("\n") || undefined;
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
        requirementIds: extractRequirementIds(`${name}\n${classname}\n${names.join("\n")}\n${failureMessage ?? ""}`, patterns)
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
