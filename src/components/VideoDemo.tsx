import { useEffect, useState } from "react";
import { api, type Video } from "../lib/api";
import { Spinner } from "./ui";

export function VideoDemo({ name, medical }: { name: string; medical: boolean }) {
  const [v, setV] = useState<Video | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { api.video(name).then(setV, () => setErr(true)); }, [name]);

  const search = `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to ${name} exercise`)}`;
  if (err) return <p className="hintline"><a href={search} target="_blank" rel="noopener">Find a demo on YouTube</a></p>;
  if (!v) return <p className="hintline"><Spinner /> Finding the best demo…</p>;
  if ("searchUrl" in v) return <p className="hintline"><a href={v.searchUrl} target="_blank" rel="noopener">Find a demo on YouTube ↗</a></p>;
  return (
    <div className="video">
      <div className="video-frame">
        <iframe src={`https://www.youtube-nocookie.com/embed/${v.videoId}?rel=0&modestbranding=1&playsinline=1`} title={v.title}
          allow="encrypted-media; picture-in-picture; fullscreen" loading="lazy" />
      </div>
      <p className="hintline">{v.title} · {v.channel}</p>
      {medical && <p className="hintline">If the video differs from your prescription or restrictions, follow your program.</p>}
    </div>
  );
}
