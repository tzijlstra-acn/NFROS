"use client";

import type { EvidenceBasis, AppendixReference } from "../data/types";

interface SlideSourceProps {
  evidenceBasis: EvidenceBasis[];
  appendixRefs: AppendixReference[];
  coreIndex: number;
  onGoToAppendix: (appendixId: string, fromCoreIndex: number) => void;
}

export default function SlideSource({
  evidenceBasis,
  appendixRefs,
  coreIndex,
  onGoToAppendix,
}: SlideSourceProps) {
  const firstEvidence = evidenceBasis[0];

  return (
    <>
      {appendixRefs.length > 0 && (
        <div className="pv24-ref-bar">
          {appendixRefs.map((ref) => (
            <button
              key={ref.appendixId}
              className="pv24-ref-chip"
              title={ref.reason}
              onClick={() => onGoToAppendix(ref.appendixId, coreIndex)}
              type="button"
            >
              {ref.label}
            </button>
          ))}
        </div>
      )}
      {firstEvidence !== undefined && (
        <p className="pv24-source-note">
          {"Source: "}
          {firstEvidence.label}
        </p>
      )}
    </>
  );
}
