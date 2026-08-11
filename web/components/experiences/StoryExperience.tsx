// web/components/experiences/StoryExperience.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useGalaxyView } from "@/lib/hooks/useGalaxyView";
import { useMusicManager } from "@/lib/hooks/useMusicManager";
import { storyConfig } from "@/lib/story/storyConfig";
import { groupByStage } from "@/lib/story/groupByStage";
import { resolveHook } from "@/lib/story/resolveHook";
import { initEffect } from "@/lib/story/effects";
import { AudioToggleButton } from "@/components/AudioToggleButton";
import styles from "./StoryExperience.module.css";
import { trackActivity } from "@/lib/activity";

interface StoryExperienceProps {
  galaxyId: string;
}

type Phase = "intro" | "chapter" | "finale";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function StoryExperience({ galaxyId }: StoryExperienceProps) {
  const { loading, view, items, music } = useGalaxyView(galaxyId);

  // Mirrors the `occasionConf` lookup inside `main()` below: the original
  // public/story/js/story.js only ever starts music after BOTH the
  // `view.storyType` check and the `occasionConf` lookup succeed. Computing
  // this synchronously during render (storyConfig is a plain imported
  // object, not async) lets us gate `useMusicManager` the same way, so music
  // never starts on either redirect-on-failure path.
  const occasionConf = useMemo(
    () => (view?.storyType ? storyConfig[view.storyType]?.occasions[view.occasion ?? ""] : undefined),
    [view],
  );
  const canPlayStory = Boolean(occasionConf);
  const musicManager = useMusicManager(canPlayStory ? music : null);

  const [phase, setPhase] = useState<Phase>("intro");
  const [introStarted, setIntroStarted] = useState(false);
  const [occasionLabel, setOccasionLabel] = useState("");
  const [chapterTag, setChapterTag] = useState("");
  const [hookText, setHookText] = useState("");
  const [hookVisible, setHookVisible] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoVisible, setPhotoVisible] = useState(false);
  const [dotsCount, setDotsCount] = useState(0);
  const [dotsActive, setDotsActive] = useState(0);
  const [progressPct, setProgressPct] = useState(0);

  const tapResolveRef = useRef<(() => void) | null>(null);
  const effectCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const startedRef = useRef(false);

  // Star positions must NOT be generated during render: this component is
  // SSR-ed (Next.js renders it once on the server to produce the initial
  // HTML, then again on the client to hydrate), and a lazy `useState`
  // initializer runs on both passes. `Math.random()` returns different
  // values each time it's called, so seeding the star field inside the
  // initializer produced a real, reproducible hydration mismatch (React
  // warning "A tree hydrated but some attributes of the server rendered
  // HTML didn't match the client properties", `40` mismatched `.seStar`
  // elements) — found via live browser verification in Task 16. Starting
  // from an empty array keeps both render passes identical, then a
  // client-only effect (which never runs during SSR) fills in the random
  // positions after hydration completes, mirroring the original inline
  // `<script>` in public/story/index.html that only ever ran in the browser.
  const [stars, setStars] = useState<
    { size: number; top: number; left: number; opacity: number }[]
  >([]);

  useEffect(() => {
    // react-hooks/set-state-in-effect normally wants setState-in-effect to
    // happen inside a callback reacting to an external event (e.g. a fetch
    // promise settling, as in useGalaxyView above) rather than synchronously
    // in the effect body. That restructuring doesn't apply here: there is no
    // async source to hang this off of — the whole point is a one-time,
    // client-only random value that must be absent from the very first
    // (server-rendered) paint to avoid the hydration mismatch described
    // above. Calling setState once in a mount-only (`[]` deps) effect is the
    // standard React-recommended pattern for exactly this case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStars(
      Array.from({ length: 40 }, () => ({
        size: Math.random() < 0.3 ? 2 : 1,
        top: Math.random() * 100,
        left: Math.random() * 100,
        opacity: Math.random() * 0.5 + 0.2,
      })),
    );
  }, []);

  const handleTap = () => tapResolveRef.current?.();

  useEffect(() => {
    if (loading || startedRef.current) return;
    startedRef.current = true;

    const waitTapOrTimer = (ms: number) =>
      new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          tapResolveRef.current = null;
          resolve();
        };
        const timer = setTimeout(finish, ms);
        tapResolveRef.current = () => {
          clearTimeout(timer);
          finish();
        };
      });

    async function playChapter(
      hook: string,
      tag: string,
      photoUrls: string[],
      chapterIdx: number,
      totalChapters: number,
    ) {
      trackActivity({ action: "Viewer Story Chapter Start", feature: "viewer", galaxyId, description: { template: "story", chapterIndex: chapterIdx, photoCount: photoUrls.length } });
      setProgressPct(totalChapters > 0 ? ((chapterIdx + 1) / totalChapters) * 100 : 0);
      setChapterTag(tag);
      setHookText(hook);

      for (let i = 0; i < photoUrls.length; i++) {
        setPhotoUrl(photoUrls[i]);
        setDotsCount(photoUrls.length > 1 ? photoUrls.length : 0);
        setDotsActive(i);
        setPhotoVisible(true);

        if (i === 0) {
          setHookVisible(true);
          await wait(2500);
          setHookVisible(false);
        }

        await waitTapOrTimer(i === 0 ? 5500 : 4500);
        setPhotoVisible(false);
        await wait(380);
      }
      setDotsCount(0);
      trackActivity({ action: "Viewer Story Chapter Complete", feature: "viewer", status: 1, galaxyId, description: { template: "story", chapterIndex: chapterIdx } });
    }

    async function main() {
      if (!view || !view.storyType) {
        window.location.replace(`/view/?galaxyId=${galaxyId}&skip_se=true`);
        return;
      }

      if (!occasionConf) {
        window.location.replace(`/view/?galaxyId=${galaxyId}&skip_se=true`);
        return;
      }

      const configChapters = occasionConf.chapters;
      const grouped = groupByStage(items);
      const chaptersWithPhotos = configChapters.filter((ch) => (grouped[ch.id] || []).length > 0);

      const stopEffect = initEffect(view.seEffect || "none", effectCanvasRef.current);

      Object.values(grouped)
        .flat()
        .forEach((url) => {
          const img = new Image();
          img.src = url;
        });

      setOccasionLabel(occasionConf.label || "");

      await new Promise<void>((resolve) => {
        tapResolveRef.current = () => {
          setIntroStarted(true);
          resolve();
        };
      });

      musicManager.play();
      document.documentElement.requestFullscreen?.().catch(() => {});
      await wait(900);

      setPhase("chapter");
      for (let i = 0; i < chaptersWithPhotos.length; i++) {
        const chapter = chaptersWithPhotos[i];
        const photos = grouped[chapter.id] || [];
        const hook = resolveHook(chapter.id, view.chapters, configChapters);
        const tag = `${chapter.label} · ${String(i + 1).padStart(2, "0")}`;
        await playChapter(hook, tag, photos, i, chaptersWithPhotos.length);
        await wait(280);
      }

      setProgressPct(100);
      setPhase("finale");
      await wait(2800);
      stopEffect();
      trackActivity({ action: "Viewer Story Complete", feature: "viewer", status: 1, galaxyId, description: { template: "story", chapterCount: chaptersWithPhotos.length } });
      window.location.replace(`/view/?galaxyId=${galaxyId}&skip_se=true`);
    }

    main();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return (
    <div className={styles.root} data-lumora-template="story">
      <div
        className={clsx(styles.seIntro, introStarted && styles.hidden)}
        data-track-action="Viewer Start Click"
        data-track-id="story_intro"
        onClick={handleTap}
        onTouchEnd={handleTap}
      >
        <div className={styles.seStars}>
          {stars.map((s, i) => (
            <div
              key={i}
              className={styles.seStar}
              style={{ width: s.size, height: s.size, top: `${s.top}%`, left: `${s.left}%`, opacity: s.opacity }}
            />
          ))}
        </div>
        <div className={styles.seIntroTitle}>{view?.name || "Lumora"}</div>
        <div className={styles.seIntroOccasion}>{occasionLabel}</div>
        <div className={styles.sePulse} />
        <div className={styles.seTapHint}>Chạm để bắt đầu</div>
      </div>

      <div className={styles.seProgressBar}>
        <div className={styles.seProgressFill} style={{ width: `${progressPct}%` }} />
      </div>

      <div className={clsx(styles.sePhoto, photoVisible && styles.visible)} data-track-action="Viewer Story Advance Click" data-track-id="story_photo" onClick={handleTap} onTouchEnd={handleTap}>
        <div className={styles.sePhotoBg} style={photoUrl ? { backgroundImage: `url('${photoUrl}')` } : undefined} />
        {photoUrl && <img className={styles.sePhotoImg} src={photoUrl} alt="" />}
        <canvas ref={effectCanvasRef} className={styles.seEffectCanvas} />
        <div className={styles.sePhotoGradient} />
        <div className={clsx(styles.seHookOverlay, hookVisible && styles.visible)}>
          <div className={styles.seChapterTag}>{chapterTag}</div>
          <div className={styles.seHookText}>{hookText}</div>
        </div>
      </div>

      <div className={styles.sePhotoDots}>
        {Array.from({ length: dotsCount }, (_, i) => (
          <div key={i} className={clsx(styles.seDot, i === dotsActive && styles.active)} />
        ))}
      </div>

      <div className={clsx(styles.seFinale, phase === "finale" && styles.visible)}>
        <div className={styles.seFinaleText}>Và đây là tất cả ký ức của chúng ta...</div>
      </div>

      <AudioToggleButton isPlaying={musicManager.isPlaying} hasTrack={musicManager.hasTrack} onToggle={musicManager.toggle} />
    </div>
  );
}
