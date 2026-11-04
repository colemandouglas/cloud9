import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Post } from "../lib/api";
import { POST_KINDS, POINTS } from "../lib/catalog";
import { prepPhoto } from "../lib/image";
import { Spinner } from "../components/ui";

const SPARKS = [
  "Small steps, every day. That's the whole secret.",
  "You don't have to feel ready. You just have to start.",
  "Rest is part of the plan, not a break from it.",
  "Progress over perfect. Show up today.",
  "Flow around the obstacle. Keep moving.",
  "The best workout is the one you actually do.",
  "Your future self is cheering for you right now.",
];

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function Community() {
  const [scope, setScope] = useState<"everyone" | "following">("everyone");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [more, setMore] = useState(true);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    setPosts(null);
    api.feed(scope).then((p) => { setPosts(p); setMore(p.length === 30); }, (e) => setErr(e.message));
  }, [scope]);
  useEffect(load, [load]);
  const spark = SPARKS[Math.floor(Date.now() / 86400000) % SPARKS.length];

  return (
    <>
      <h2>Community</h2>
      <section className="spark"><span aria-hidden="true">≈</span>{spark}</section>
      <Composer onPosted={load} />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={scope === "everyone"} onClick={() => setScope("everyone")}>Everyone</button>
        <button role="tab" aria-selected={scope === "following"} onClick={() => setScope("following")}>Friends</button>
      </div>
      {err && <p className="err">{err}</p>}
      {!posts && !err && <p className="loading">Loading…</p>}
      {posts?.length === 0 && <section className="card center"><p className="sub" style={{ margin: 0 }}>{scope === "following" ? "Follow friends to see their posts here." : "Be the first to share a win."}</p></section>}
      {posts?.map((p) => (
        <PostCard key={p.id} p={p} onDelete={() => setPosts(posts.filter((x) => x.id !== p.id))} />
      ))}
      {posts && more && posts.length > 0 && (
        <button className="btn ghost" onClick={() => api.feed(scope, posts[posts.length - 1].createdAt).then((p) => { setPosts([...posts, ...p]); setMore(p.length === 30); })}>Load more</button>
      )}
    </>
  );
}

function Composer({ onPosted }: { onPosted: () => void }) {
  const [kind, setKind] = useState("workout");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(f?: File) {
    if (!f) return;
    setErr("");
    try {
      const b = await prepPhoto(f);
      setPhoto(b);
      setPreview(URL.createObjectURL(b));
    } catch {
      setErr("Couldn't read that photo. Try a JPG or PNG.");
    }
  }
  async function submit() {
    if (!text.trim() && !photo) return setErr("Add a photo or a few words.");
    setBusy(true);
    setErr("");
    try {
      await api.createPost(kind, text, photo);
      setText(""); setPhoto(null); setPreview("");
      if (fileRef.current) fileRef.current.value = "";
      onPosted();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card composer">
      <div className="chips">
        {POST_KINDS.map(([k, l]) => <button type="button" key={k} className="chip" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      <textarea maxLength={280} value={text} onChange={(e) => setText(e.target.value)} aria-label="Post"
        placeholder={kind === "food" ? "What's on the plate?" : kind === "win" ? "Share a win, big or small" : "How did today's session go?"} />
      {preview && (
        <div className="preview">
          <img src={preview} alt="Your photo" />
          <button type="button" className="linkbtn" onClick={() => { setPhoto(null); setPreview(""); if (fileRef.current) fileRef.current.value = ""; }}>Remove photo</button>
        </div>
      )}
      <div className="composer-row">
        <label className="btn ghost small photo-btn">
          <input ref={fileRef} type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} />
          📷 Photo <span className="muted">+{POINTS.photo} pt</span>
        </label>
        <span className="muted small">{280 - text.length}</span>
        <button className="btn small" disabled={busy} onClick={submit}>{busy ? <Spinner /> : "Post"}</button>
      </div>
      {err && <p className="err">{err}</p>}
    </section>
  );
}

function PostCard({ p, onDelete }: { p: Post; onDelete: () => void }) {
  const [cheered, setCheered] = useState(p.cheered);
  const [count, setCount] = useState(p.cheers);
  const kind = POST_KINDS.find(([k]) => k === p.kind)?.[1];
  return (
    <article className="card post">
      <header>
        <span className="av">{(p.author.name || p.author.handle)[0]?.toUpperCase()}</span>
        <div><b>{p.author.name}</b><span className="muted"> @{p.author.handle} · {ago(p.createdAt)}</span></div>
        {kind && <span className="pill p-new">{kind}</span>}
      </header>
      {p.photoUrl && <img className="post-img" src={p.photoUrl} alt={`${p.author.name}'s ${kind?.toLowerCase() || ""} photo`} loading="lazy" />}
      {p.text && <p className="post-text">{p.text}</p>}
      <footer>
        <button className={`cheer ${cheered ? "on" : ""}`} aria-pressed={cheered}
          onClick={() => api.cheer(p.id).then((r) => { setCheered(r.cheered); setCount(count + (r.cheered ? 1 : -1)); })}>
          👏 {count > 0 ? count : "Cheer"}
        </button>
        {p.canDelete && <button className="linkbtn muted" onClick={() => confirm("Delete this post?") && api.deletePost(p.id).then(onDelete)}>Delete</button>}
      </footer>
    </article>
  );
}
