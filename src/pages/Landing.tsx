import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { GoalIcon, Logo } from "../components/ui";
import { GOALS } from "../lib/catalog";
import { api, type Me } from "../lib/api";

const STEPS = [
  ["Pick where you're headed", "A race, a trip, a recovery, or just feeling good again."],
  ["Make it yours", "Your schedule, your equipment, your body. Add doctor's notes or scans if you have them."],
  ["Follow it day by day", "Log how each session felt. Every 4 weeks your plan adapts to how you're responding."],
];

export default function Landing() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { api.me().then(setMe, () => {}); }, []);
  return (
    <div className="landing">
      <header className="site-nav">
        <div className="inner">
          <Link to="/" className="brand"><Logo size={30} /><h1>Be Like Water</h1></Link>
          <nav aria-label="Account">
            {me ? <Link className="cta" to="/app">My journeys</Link> : <Link to="/signin">Sign in</Link>}
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="inner">
          <p className="eyebrow">Training and recovery that adapts to you</p>
          <h2>Where do you want to go?</h2>
          <p className="lede">Choose a goal and we'll build a plan around your body, your schedule and your life, then adjust it as you go.</p>
          <div className="goals">
            {Object.entries(GOALS).map(([key, g]) => (
              <Link key={key} className="goal" to={`/start/${key}`}>
                <span className="goal-ic"><GoalIcon name={g.icon} /></span>
                <span className="goal-tx"><b>{g.title}</b><span>{g.blurb}</span></span>
                <span className="goal-go" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
          <p className="hero-note">Free during the beta. About 5 minutes to set up.</p>
        </div>
      </section>

      <section className="section">
        <div className="inner">
          <div className="cols3">
            {STEPS.map(([t, d], i) => (
              <div key={t}>
                <div className="num">{i + 1}</div>
                <h3>{t}</h3>
                <p className="sub" style={{ margin: 0 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="inner soon">
          <div>
            <span className="pill p-review">Coming soon</span>
            <h2 style={{ marginTop: 10 }}>1:1 coaching</h2>
            <p className="sub" style={{ margin: 0 }}>Work with a personal trainer or physical therapist on top of your plan. Join the list from inside the app.</p>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="inner">
          <span>© {new Date().getFullYear()} Be Like Water · <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link></span>
          <span>Beta. Programs are general guidance, not medical advice. In an emergency, call 911.</span>
        </div>
      </footer>
    </div>
  );
}
