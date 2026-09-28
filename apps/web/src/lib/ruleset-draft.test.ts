import { describe, expect, it } from "vitest";
import { DEFAULT_RULESET } from "@doorframe/core";
import { clearRulesetDraft, readRulesetDraft, rulesetDraftKey, writeRulesetDraft } from "./ruleset-draft";
import { formValuesFromRuleset, type RulesetFormValues } from "./ruleset-form";
import type { StorageLike } from "./session-store";

const saved = formValuesFromRuleset(DEFAULT_RULESET);
const edited: RulesetFormValues = {
  ...saved,
  vagueTerms: `${saved.vagueTerms}, foo`,
  disabledCategories: [...saved.disabledCategories, "stale_link"]
};

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key)
  };
}

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  }
};

describe("ruleset drafts", () => {
  it("keeps edits per project and restores them", () => {
    const storage = memoryStorage();
    writeRulesetDraft(storage, "p1", saved, edited);

    expect([...storage.data.keys()]).toEqual([rulesetDraftKey("p1")]);
    expect(readRulesetDraft(storage, "p1", saved)).toEqual(edited);
    expect(readRulesetDraft(storage, "p2", saved)).toBeNull();
  });

  it("keeps an edit to any one field", () => {
    for (const field of Object.keys(saved) as Array<keyof RulesetFormValues>) {
      const storage = memoryStorage();
      const values: RulesetFormValues =
        field === "disabledCategories"
          ? { ...saved, disabledCategories: ["stale_link"] }
          : { ...saved, [field]: `${saved[field]} x` };
      writeRulesetDraft(storage, "p1", saved, values);

      expect(readRulesetDraft(storage, "p1", saved), field).toEqual(values);
    }
  });

  it("removes the draft once the values match the saved ruleset again", () => {
    const storage = memoryStorage();
    writeRulesetDraft(storage, "p1", saved, edited);
    writeRulesetDraft(storage, "p1", saved, { ...saved });

    expect(storage.data.size).toBe(0);
  });

  it("ignores a draft that started from a ruleset saved since", () => {
    const storage = memoryStorage();
    writeRulesetDraft(storage, "p1", saved, edited);

    expect(readRulesetDraft(storage, "p1", { ...saved, jaccardThreshold: "0.9" })).toBeNull();
  });

  it("ignores a draft with no changes or an unexpected shape", () => {
    const storage = memoryStorage();
    storage.setItem(rulesetDraftKey("p1"), JSON.stringify({ saved, values: saved }));
    expect(readRulesetDraft(storage, "p1", saved)).toBeNull();

    storage.setItem(rulesetDraftKey("p1"), JSON.stringify({ saved, values: { ...edited, jaccardThreshold: 0.9 } }));
    expect(readRulesetDraft(storage, "p1", saved)).toBeNull();

    storage.setItem(rulesetDraftKey("p1"), JSON.stringify({ saved, values: { ...edited, disabledCategories: "all" } }));
    expect(readRulesetDraft(storage, "p1", saved)).toBeNull();

    storage.setItem(rulesetDraftKey("p1"), "{not json");
    expect(readRulesetDraft(storage, "p1", saved)).toBeNull();

    storage.setItem(rulesetDraftKey("p1"), "null");
    expect(readRulesetDraft(storage, "p1", saved)).toBeNull();
  });

  it("clears a draft", () => {
    const storage = memoryStorage();
    writeRulesetDraft(storage, "p1", saved, edited);
    clearRulesetDraft(storage, "p1");

    expect(readRulesetDraft(storage, "p1", saved)).toBeNull();
  });

  it("works without storage and when storage throws", () => {
    expect(readRulesetDraft(null, "p1", saved)).toBeNull();
    expect(readRulesetDraft(throwingStorage, "p1", saved)).toBeNull();
    expect(() => writeRulesetDraft(throwingStorage, "p1", saved, edited)).not.toThrow();
    expect(() => writeRulesetDraft(throwingStorage, "p1", saved, saved)).not.toThrow();
    expect(() => clearRulesetDraft(throwingStorage, "p1")).not.toThrow();
    expect(() => writeRulesetDraft(null, "p1", saved, edited)).not.toThrow();
  });
});
