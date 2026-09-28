import type { TraceLinkInput } from "@doorframe/core";
import { TRACE_LINK_RULES } from "@doorframe/storage";

/**
 * Trace references remember which requirement IDs a work item or test case
 * mentioned when it was imported, even when that requirement is not in the
 * project yet. Links are then created whichever file is imported first.
 *
 * Everything in this module is pure planning; lib/imports.ts applies the plans.
 */

export type ReferencingEntityType = "workItem" | "testCase";

export interface TraceReference {
  entityType: ReferencingEntityType;
  entityExternalId: string;
  requirementExternalId: string;
  linkType: "implements" | "verifies";
  confidence: number;
  source: string;
}

/** Link rule for requirement -> entity links: Jira work items implement, tests verify. */
export function referenceRule(entityType: ReferencingEntityType) {
  return entityType === "workItem" ? TRACE_LINK_RULES.implements : TRACE_LINK_RULES.verifies;
}

/** Build the references one import stores for each entity (duplicates removed). */
export function buildTraceReferences(
  entityType: ReferencingEntityType,
  entities: Array<{ externalId: string; requirementIds: string[] }>,
  source: string
): TraceReference[] {
  const rule = referenceRule(entityType);
  const seen = new Set<string>();
  const references: TraceReference[] = [];

  entities.forEach((entity) => {
    entity.requirementIds.forEach((requirementExternalId) => {
      const key = `${entity.externalId}\u0000${requirementExternalId}`;
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      references.push({
        entityType,
        entityExternalId: entity.externalId,
        requirementExternalId,
        linkType: rule.linkType,
        confidence: rule.confidence,
        source
      });
    });
  });

  return references;
}

/** Identity of a trace link, matching the trace_links unique constraint. */
export function traceLinkKey(link: {
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  linkType: string;
}): string {
  return [link.sourceType, link.sourceId, link.targetType, link.targetId, link.linkType].join("\u0000");
}

export interface ExistingEntityLink {
  linkId: string;
  requirementId: string;
  entityId: string;
}

export interface LinkSyncPlan {
  create: TraceLinkInput[];
  deleteLinkIds: string[];
}

/**
 * Plan the requirement -> entity links for entities that were just imported:
 * create links to referenced requirements that exist, and delete links to
 * requirements the entity no longer mentions. Links of other entities are
 * left alone.
 */
export function planLinkSync(input: {
  entityType: ReferencingEntityType;
  source: string;
  entities: Array<{ entityId: string; requirementExternalIds: string[] }>;
  requirementIdByExternalId: ReadonlyMap<string, string>;
  /** Existing requirement -> entity links of this entity type's link type. */
  existingLinks: ExistingEntityLink[];
}): LinkSyncPlan {
  const rule = referenceRule(input.entityType);
  const existingByEntity = new Map<string, ExistingEntityLink[]>();
  input.existingLinks.forEach((link) => {
    existingByEntity.set(link.entityId, [...(existingByEntity.get(link.entityId) ?? []), link]);
  });

  const create: TraceLinkInput[] = [];
  const deleteLinkIds: string[] = [];

  input.entities.forEach((entity) => {
    const wanted = new Set(
      entity.requirementExternalIds
        .map((externalId) => input.requirementIdByExternalId.get(externalId))
        .filter((id): id is string => Boolean(id))
    );
    const existing = existingByEntity.get(entity.entityId) ?? [];
    const linked = new Set(existing.map((link) => link.requirementId));

    existing.forEach((link) => {
      if (!wanted.has(link.requirementId)) {
        deleteLinkIds.push(link.linkId);
      }
    });

    wanted.forEach((requirementId) => {
      if (linked.has(requirementId)) {
        return;
      }

      create.push({
        sourceType: "requirement",
        sourceId: requirementId,
        targetType: input.entityType,
        targetId: entity.entityId,
        linkType: rule.linkType,
        confidence: rule.confidence,
        source: input.source
      });
    });
  });

  return { create, deleteLinkIds };
}

/**
 * Plan the links stored references allow once their requirements exist, e.g.
 * after a requirements import that follows a Jira or JUnit import. Skips
 * references whose requirement or entity is missing and links that exist.
 */
export function planReferenceLinks(input: {
  references: TraceReference[];
  requirementIdByExternalId: ReadonlyMap<string, string>;
  entityIdByExternalId: Record<ReferencingEntityType, ReadonlyMap<string, string>>;
  existingLinkKeys: ReadonlySet<string>;
}): TraceLinkInput[] {
  const planned = new Set<string>();
  const links: TraceLinkInput[] = [];

  input.references.forEach((reference) => {
    const requirementId = input.requirementIdByExternalId.get(reference.requirementExternalId);
    const entityId = input.entityIdByExternalId[reference.entityType].get(reference.entityExternalId);
    if (!requirementId || !entityId) {
      return;
    }

    const link: TraceLinkInput = {
      sourceType: "requirement",
      sourceId: requirementId,
      targetType: reference.entityType,
      targetId: entityId,
      linkType: reference.linkType,
      confidence: reference.confidence,
      source: reference.source
    };
    const key = traceLinkKey(link);
    if (input.existingLinkKeys.has(key) || planned.has(key)) {
      return;
    }

    planned.add(key);
    links.push(link);
  });

  return links;
}

/**
 * Plan missing parent -> child requirement links. Children keep their parent's
 * external ID, so a parent imported after its children still gets linked.
 */
export function planParentLinks(input: {
  requirements: Array<{ id: string; parentExternalId?: string; source: string }>;
  requirementIdByExternalId: ReadonlyMap<string, string>;
  existingLinkKeys: ReadonlySet<string>;
}): TraceLinkInput[] {
  const links: TraceLinkInput[] = [];

  input.requirements.forEach((child) => {
    const parentId = child.parentExternalId ? input.requirementIdByExternalId.get(child.parentExternalId) : undefined;
    if (!parentId || parentId === child.id) {
      return;
    }

    const link: TraceLinkInput = {
      sourceType: "requirement",
      sourceId: parentId,
      targetType: "requirement",
      targetId: child.id,
      linkType: TRACE_LINK_RULES.parent.linkType,
      confidence: TRACE_LINK_RULES.parent.confidence,
      source: child.source
    };
    if (!input.existingLinkKeys.has(traceLinkKey(link))) {
      links.push(link);
    }
  });

  return links;
}

/**
 * Parent links that no longer match a child's current Parent ID, for example
 * after the parent changed or was cleared in a newer export.
 */
export function staleParentLinkIds(input: {
  requirements: Array<{ id: string; parentExternalId?: string }>;
  requirementIdByExternalId: ReadonlyMap<string, string>;
  existingParentLinks: Array<{ linkId: string; parentId: string; childId: string }>;
}): string[] {
  const wantedParent = new Map(
    input.requirements.map((child) => [
      child.id,
      child.parentExternalId ? input.requirementIdByExternalId.get(child.parentExternalId) : undefined
    ])
  );

  return input.existingParentLinks
    .filter((link) => wantedParent.has(link.childId) && wantedParent.get(link.childId) !== link.parentId)
    .map((link) => link.linkId);
}
