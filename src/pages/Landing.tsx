import { Link } from "react-router-dom";
import { Logo } from "../components/ui";
import { TEMPLATES } from "../lib/protocol";

const STEPS = [
  ["Tell us what hurts", "A five-minute intake covers your symptoms, what makes them better or worse, and the goals you want to get back to. Safety checks come first."],
  ["Add your imaging", "Upload a photo or PDF of your MRI or X-ray report, or paste the text. The written report tells your therapist more than the scan images."],
  ["Get your protocol", "A licensed physical therapist reviews everything, usually within 2 business days, and assigns a week-by-week program that progresses with you."],
];

const FAQ = [
  ["Is this a replacement for seeing a doctor?", "No. Be Like Water is guided exercise reviewed by a physical therapist. If the safety checks pick up a warning sign, we ask you to see a doctor before starting anything."],
  ["Who reviews my case?", "A licensed physical therapist reads your intake and imaging and chooses your program. Nothing is assigned automatically."],
  ["What if my symptoms change?", "Stop any exercise that sends pain further down your leg and message your therapist. Your program is adjusted as you go, which is where the name comes from."],
  ["Can I use it on my phone?", "Yes. Open the app in your phone's browser and add it to your home screen. It works like an installed app."],
];

export default function Landing() {
  return (
    <>
      <header className="site-nav">
        <div className="inner">
          <Link to="/" className="brand">
            <Logo size={30} />
            <h1>Be Like Water</h1>
          </Link>
          <nav aria-label="Site">
            <a href="#how">How it works</a>
            <a href="#programs">Programs</a>
            <a href="#faq">FAQ</a>
            <Link className="cta" to="/app">Open the app</Link>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="inner">
          <div>
            <h2>Spine recovery that <em>adapts to you.</em></h2>
            <p className="lede">
              Back pain and sciatica programs built by a physical therapist around your symptoms, your imaging and the
              things you want to get back to doing.
            </p>
            <div className="ctas">
              <Link className="btn gold" to="/app/intake">Start your intake</Link>
              <a className="btn outline" href="#how">See how it works</a>
            </div>
          </div>
          <div className="phone" aria-hidden="true">
            <div className="steps" style={{ marginBottom: 12 }}>
              <div className="on">Submitted</div>
              <div className="on">In review</div>
              <div className="on">Program ready</div>
            </div>
            <div className="card">
              <h3>Your protocol: {TEMPLATES.stenosis.name}</h3>
              <p className="sub" style={{ marginBottom: 6 }}>Phase 1: foundation</p>
              <ul className="week">
                {TEMPLATES.stenosis.week.slice(0, 4).map(([d, x]) => (
                  <li key={d}><b>{d}</b>{x}</li>
                ))}
              </ul>
            </div>
            <div className="note" style={{ margin: "4px 0 0" }}>Golf by December. Let's build toward it.</div>
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="inner">
          <h2>How it works</h2>
          <p className="intro">Three steps from first twinge to a plan you can follow every day.</p>
          <div className="cols3">
            {STEPS.map(([t, d], i) => (
              <div className="card" key={t}>
                <div className="num">{i + 1}</div>
                <h3>{t}</h3>
                <p className="sub" style={{ margin: 0 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt" id="programs">
        <div className="inner">
          <h2>Programs for how your back actually behaves</h2>
          <p className="intro">
            What makes your pain better or worse says a lot. Your therapist matches you to a starting program, then
            progresses it through three phases: foundation, load and rotation, and sport prep.
          </p>
          <div className="cols2">
            {Object.values(TEMPLATES).map((t) => (
              <div className="card" key={t.name} style={{ background: "var(--soft)" }}>
                <h3>{t.name}</h3>
                <p className="sub" style={{ margin: 0 }}>{t.fit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="inner cols2" style={{ alignItems: "start" }}>
          <div>
            <h2>Safety comes first</h2>
            <p className="intro" style={{ marginBottom: 0 }}>
              Every intake starts with emergency checks for warning signs like numbness in the groin, new bladder or
              bowel trouble, or worsening leg weakness. If any apply, we stop and send you to a doctor, and your
              therapist is alerted.
            </p>
          </div>
          <div>
            <h2>For clinicians</h2>
            <p className="intro" style={{ marginBottom: 16 }}>
              A review queue with red flags at the top, a pattern note to speed up triage, imaging in one place, and
              one-tap program assignment.
            </p>
            <Link className="btn ghost small" to="/clinician">Open the clinician view</Link>
          </div>
        </div>
      </section>

      <section className="section alt" id="faq">
        <div className="inner">
          <h2>Questions</h2>
          <div className="cols2" style={{ marginTop: 24 }}>
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <h3>{q}</h3>
                <p className="sub">{a}</p>
              </div>
            ))}
          </div>
          <Link className="btn" to="/app/intake" style={{ maxWidth: 320, marginTop: 16 }}>Start your intake</Link>
        </div>
      </section>

      <footer className="site-footer">
        <div className="inner">
          <span>© {new Date().getFullYear()} Be Like Water</span>
          <span>Prototype. Not medical advice and not emergency care. In an emergency, call 911.</span>
        </div>
      </footer>
    </>
  );
}
