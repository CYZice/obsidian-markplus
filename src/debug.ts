import { MARKPLUS_DEBUG } from "./constants";

let markplusLogSeq = 0;

export function mpLog(_event: string, _payload?: unknown): void {
  if (MARKPLUS_DEBUG) {
    markplusLogSeq += 1;
  }
}

export function summarizeMutations(records: MutationRecord[]) {
  let ownDecorationMutations = 0;
  let otherMutations = 0;
  const samples: Array<{
    type: string;
    target: string | undefined;
    added: number;
    removed: number;
  }> = [];

  for (const record of records) {
    const nodes = [
      ...Array.from(record.addedNodes),
      ...Array.from(record.removedNodes),
    ];
    const isOwnMutation = nodes.some(
      (node) =>
        node.nodeType === 1 &&
        ((node as Element).classList?.contains("markplus-colgroup") ||
          (node as Element).classList?.contains("markplus-column-handle") ||
          (node as Element).classList?.contains("markplus-table-scale-handle") ||
          (node as Element).classList?.contains("markplus-table-menu-button") ||
          (node as Element).classList?.contains("markplus-cell-fill-handle") ||
          (node as Element).classList?.contains("markplus-formula-result") ||
          (node as Element).tagName === "COL"),
    );

    if (isOwnMutation) {
      ownDecorationMutations += 1;
      continue;
    }

    otherMutations += 1;
    if (samples.length >= 3) {
      continue;
    }

    const target = record.target;
    samples.push({
      type: record.type,
      target:
        target?.nodeType === 1
          ? `${(target as Element).tagName}.${(target as Element).className || ""}`.trim()
          : target?.nodeName,
      added: record.addedNodes.length,
      removed: record.removedNodes.length,
    });
  }

  return {
    total: records.length,
    ownDecorationMutations,
    otherMutations,
    samples,
  };
}
