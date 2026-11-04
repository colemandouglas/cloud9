import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type Friend, type Me } from "../lib/api";
import { Spinner } from "../components/ui";

type Data = Awaited<ReturnType<typeof api.friends>>;

export default function Friends() {
  const [data, setData] = useState<Data | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [profile, setProfile] = useState<{ handle: string; name: string } | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api.friends().then(setData, (e) => setErr(e.message)), []);
  useEffect(() => { load(); api.profile().then(setProfile); api.me().then(setMe, () => {}); }, [load]);

  if (err) return <p className="err">{err}</p>;
  if (!data || !profile) return <p className="loading">Loading…</p>;
  return (
    <>
      <h2>Friends</h2>
      <Board rows={data.board} onUnfollow={(h) => api.unfollow(h).then(load)} />
      <FollowForm onDone={load} />
      {data.followers.length > 0 && (
        <section className="card">
          <h3>Following you</h3>
          <ul className="people">
            {data.followers.map((f) => (
              <li key={f.handle}>
                <span><b>{f.name}</b> <span className="muted">@{f.handle}</span></span>
                {!f.followingBack && <button className="btn ghost small" onClick={() => api.follow(f.handle).then(load)}>Follow back</button>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <ProfileCard profile={profile} setProfile={setProfile} isAdmin={!!me?.isAdmin} />
      <DeleteAccount />
    </>
  );
}

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  if (!open) return <p className="center" style={{ marginTop: 24 }}><button className="linkbtn muted" onClick={() => setOpen(true)}>Delete my account</button></p>;
  return (
    <section className="card danger">
      <h3>Delete your account</h3>
      <p className="sub">This permanently deletes your account, journeys, uploaded records, workout logs, steps, posts and Oura data. It can't be undone.</p>
      <label className="f" htmlFor="del">Type DELETE to confirm</label>
      <input id="del" type="text" autoCapitalize="characters" value={text} onChange={(e) => setText(e.target.value)} />
      {err && <p className="err">{err}</p>}
      <div className="row">
        <button className="btn small danger-btn" disabled={text !== "DELETE"} onClick={() => api.deleteAccount().then(() => (location.href = "/"), (e) => setErr(e.message))}>Delete everything</button>
        <button className="btn ghost small" onClick={() => { setOpen(false); setText(""); }}>Cancel</button>
      </div>
    </section>
  );
}

function Board({ rows, onUnfollow }: { rows: Friend[]; onUnfollow: (h: string) => void }) {
  return (
    <section className="card">
      <h3>This week</h3>
      <ol className="board">
        {rows.map((r, i) => (
          <li key={r.handle} className={r.me ? "me" : ""}>
            <span className="rank">{i + 1}</span>
            <span className="who"><b>{r.me ? "You" : r.name}</b><span className="muted">@{r.handle}{r.todaySteps != null ? ` · ${r.todaySteps.toLocaleString("en-US")} steps today` : ""}</span></span>
            <span className="streak" title="Day streak">🔥 {r.streak}</span>
            <span className="wpts"><b>{r.weekPoints}</b><span>pts</span></span>
            {!r.me && <button className="iconbtn" aria-label={`Unfollow ${r.name}`} onClick={() => confirm(`Unfollow @${r.handle}?`) && onUnfollow(r.handle)}>×</button>}
          </li>
        ))}
      </ol>
      {rows.length === 1 && <p className="sub" style={{ margin: "10px 0 0" }}>Follow friends to see how you stack up.</p>}
    </section>
  );
}

function FollowForm({ onDone }: { onDone: () => void }) {
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await api.follow(handle);
      setMsg(`Following @${handle.replace(/^@/, "")}.`);
      setHandle("");
      onDone();
    } catch (x) {
      setMsg((x as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card" onSubmit={submit}>
      <h3>Follow a friend</h3>
      <div className="steps-form">
        <input type="text" autoCapitalize="none" autoCorrect="off" placeholder="@username" aria-label="Friend's username" value={handle} onChange={(e) => setHandle(e.target.value)} />
        <button className="btn small" disabled={busy || !handle.trim()}>{busy ? <Spinner /> : "Follow"}</button>
      </div>
      {msg && <p className="sub" style={{ margin: "8px 0 0" }} role="status">{msg}</p>}
    </form>
  );
}

function ProfileCard({ profile, setProfile, isAdmin }: { profile: { handle: string; name: string }; setProfile: (p: { handle: string; name: string }) => void; isAdmin: boolean }) {
  const [handle, setHandle] = useState(profile.handle);
  const [name, setName] = useState(profile.name);
  const [msg, setMsg] = useState("");
  const invite = `Join me on Be Like Water! Follow me: @${profile.handle} ${location.origin}`;
  return (
    <section className="card">
      <h3>Your profile</h3>
      <p className="sub">Friends see your name, username, points, streak and posts. Never your health details or program.</p>
      <div className="grid2">
        <div className="fld"><label className="f" htmlFor="pn">Name</label><input id="pn" type="text" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="fld"><label className="f" htmlFor="ph">Username</label><input id="ph" type="text" autoCapitalize="none" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} /></div>
      </div>
      <div className="row" style={{ marginTop: 0 }}>
        <button className="btn small" onClick={() => api.saveProfile(handle, name).then((p) => { setProfile(p); setMsg("Saved."); }, (e) => setMsg(e.message))}>Save</button>
        <button className="btn ghost small" onClick={() => (navigator.share ? navigator.share({ text: invite }).catch(() => {}) : navigator.clipboard.writeText(invite).then(() => setMsg("Invite copied.")))}>Invite a friend</button>
      </div>
      {msg && <p className="sub" style={{ margin: "8px 0 0" }} role="status">{msg}</p>}
      {isAdmin && <p className="hintline">Sign-ups are invite-only right now. Add a friend's email to ALLOWED_EMAILS in Render before they join.</p>}
    </section>
  );
}
