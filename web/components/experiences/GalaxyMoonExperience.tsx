// web/components/experiences/GalaxyMoonExperience.tsx
// STUB — replaced wholesale by the GalaxyMoonExperience implementation plan.
"use client";

interface GalaxyMoonExperienceProps {
  galaxyId: string;
}

export function GalaxyMoonExperience({ galaxyId }: GalaxyMoonExperienceProps) {
  return (
    <div data-lumora-template="galaxy" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", background: "#000", color: "#fff" }}>
      Galaxy experience for {galaxyId} — coming in a later plan.
    </div>
  );
}
