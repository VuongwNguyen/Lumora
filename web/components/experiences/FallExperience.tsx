// web/components/experiences/FallExperience.tsx
// STUB — replaced wholesale by the FallExperience implementation plan.
"use client";

interface FallExperienceProps {
  galaxyId: string;
}

export function FallExperience({ galaxyId }: FallExperienceProps) {
  return (
    <div data-lumora-template="fall" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", background: "#000", color: "#fff" }}>
      Fall experience for {galaxyId} — coming in a later plan.
    </div>
  );
}
