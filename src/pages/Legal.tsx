import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/ui";

const UPDATED = "November 4, 2026";

function useContact() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/site").then((r) => r.json()).then((d) => setEmail(d.contactEmail), () => {});
  }, []);
  return email;
}

function Contact() {
  const email = useContact();
  return email ? <a href={`mailto:${email}`}>{email}</a> : <>the contact address we'll list here</>;
}

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => { document.title = `${title} · Be Like Water`; window.scrollTo(0, 0); return () => { document.title = "Be Like Water"; }; }, [title]);
  return (
    <div className="landing">
      <header className="site-nav">
        <div className="inner"><Link to="/" className="brand"><Logo size={30} /><h1>Be Like Water</h1></Link></div>
      </header>
      <main className="legal">
        <h2>{title}</h2>
        <p className="muted">Last updated {UPDATED}</p>
        {children}
        <p className="muted" style={{ marginTop: 32 }}>
          <Link to="/privacy">Privacy Policy</Link> · <Link to="/terms">Terms of Service</Link> · <Link to="/">Home</Link>
        </p>
      </main>
    </div>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Be Like Water ("we", "us") is a training and recovery app in private beta. This policy explains what we collect, why, who
        else touches it, and the choices you have. We wrote it in plain language. If anything is unclear, contact us at <Contact />.
      </p>

      <h3>What we collect</h3>
      <ul>
        <li><b>Account details:</b> your email address, name, and the username you choose.</li>
        <li><b>Your intake:</b> your goal, event or trip details, age, height, weight, activity level, schedule, equipment, injuries, and your answers to the health and safety questions.</li>
        <li><b>Health information you choose to share:</b> symptoms, pain levels, diagnoses, treatment plans, restrictions, and medical documents you upload, such as MRI or X-ray reports.</li>
        <li><b>Your training activity:</b> the sessions you complete, effort and pain ratings, notes, check-ins, steps you enter, and the days you open the app.</li>
        <li><b>Community content:</b> posts, photos and cheers you share. Photos are resized on your device before upload, which removes hidden location data.</li>
        <li><b>Oura data, if you connect a ring:</b> daily steps, calories burned, readiness score and sleep score.</li>
        <li><b>Basic technical data:</b> a sign-in cookie that keeps you logged in, and standard server logs (such as IP address and request times) used to keep the service running and secure.</li>
      </ul>

      <h3>How we use it</h3>
      <ul>
        <li>To build your program and adjust it every few weeks based on your intake, uploads, workout log and check-ins.</li>
        <li>To show your progress, points, streaks and friends leaderboard.</li>
        <li>To flag safety concerns. If you report warning signs or high pain, the app tells you to see a doctor and alerts our coach.</li>
        <li>To let our coach review your program and leave notes for you.</li>
        <li>To send sign-in links and service messages, such as "your program is ready".</li>
      </ul>
      <p>We do not sell your data, use it for advertising, or share it with data brokers.</p>

      <h3>AI processing</h3>
      <p>
        Your program is written by an AI model (Claude, provided by Anthropic). To do that, we send your intake, the medical documents you
        upload, your workout log and your check-ins to Anthropic's API. Anthropic processes this data to return your program and, under its
        commercial terms, does not use it to train its models. We also use AI to choose exercise demo videos; for that, only the exercise name
        and public YouTube information are sent, never your personal data.
      </p>
      <p>
        <b>Oura data is never sent to any AI model.</b> It is used only to display your stats, award points and show a simple readiness tip.
      </p>

      <h3>Who else handles your data</h3>
      <ul>
        <li><b>Anthropic</b> generates programs, as described above.</li>
        <li><b>Render</b> hosts the app, its database and your uploads.</li>
        <li><b>Oura</b> provides your ring data, only if you connect it. Oura's own privacy policy covers what it collects.</li>
        <li><b>YouTube (Google)</b> plays exercise demo videos. Videos are embedded in privacy-enhanced mode, but YouTube may still collect data when you press play, under Google's privacy policy.</li>
        <li><b>Our email provider</b> delivers sign-in links and service emails.</li>
      </ul>

      <h3>Who can see what</h3>
      <ul>
        <li><b>Only you and our coach</b> can see your intake, health information, uploads and program.</li>
        <li><b>Friends and other members</b> can see your name, username, points, streak, steps and the community posts you choose to share. Never your health details or program.</li>
      </ul>

      <h3>Your choices</h3>
      <ul>
        <li><b>Delete your account</b> at any time from the bottom of the Friends tab. This permanently deletes your account, journeys, uploads, logs, steps, posts and Oura data.</li>
        <li><b>Disconnect Oura</b> from the Points tab. This removes the synced Oura data.</li>
        <li><b>Delete a community post</b> at any time.</li>
        <li><b>Ask us</b> for a copy of your data, or to correct it, at <Contact />.</li>
      </ul>

      <h3>Security and retention</h3>
      <p>
        Data is sent over encrypted connections, and uploads are only available to you and our coach when signed in. We keep your data while
        your account is open and delete it when you delete your account. Backups and logs may take up to 30 days to clear.
      </p>
      <p>
        Be Like Water is not a healthcare provider, and during the beta it is not set up as a HIPAA-covered service. Please only upload
        medical documents you're comfortable sharing on that basis.
      </p>

      <h3>Age</h3>
      <p>Be Like Water is for people 18 and older.</p>

      <h3>Changes</h3>
      <p>If we make important changes to this policy, we'll update the date above and let you know in the app or by email.</p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms cover your use of Be Like Water, a training and recovery app in private beta. By creating an account you agree to them.
        Questions: <Contact />.
      </p>

      <h3>Not medical advice</h3>
      <p>
        Programs, videos, tips and community content are general fitness and wellness guidance, created with the help of AI. They are not
        medical advice, diagnosis or treatment, and they don't replace your doctor, physical therapist or other healthcare provider. Talk to
        a professional before starting a new program, especially if you have a medical condition, injury, recent surgery or are pregnant.
        Always follow your own doctor's instructions over anything in the app.
      </p>
      <p>
        <b>Stop exercising and get medical help</b> if you have chest pain, dizziness, shortness of breath that isn't normal for you, pain
        spreading down a limb, new numbness or weakness, or loss of bladder or bowel control. In an emergency, call 911.
      </p>

      <h3>Your responsibility</h3>
      <p>
        Exercise carries a risk of injury. You choose whether and how to do each session, and you take part at your own risk. Use the lighter
        option or skip a session when something doesn't feel right. Give accurate information in your intake so your program fits you.
      </p>

      <h3>The beta</h3>
      <p>
        Be Like Water is in an early beta. Features may change, break or be removed, and we may limit or end access. We'll try to give
        notice before major changes.
      </p>

      <h3>Your account</h3>
      <p>
        You must be 18 or older. Keep access to your email secure, since we use it to sign you in. You can delete your account at any time.
      </p>

      <h3>Community rules</h3>
      <ul>
        <li>Be kind and encouraging. No harassment, hate, or bullying.</li>
        <li>Only post photos you have the right to share, and nothing sexual, violent or illegal.</li>
        <li>Don't give other members medical advice or promote unsafe practices, extreme diets or supplements.</li>
        <li>No spam or advertising.</li>
      </ul>
      <p>We may remove posts or suspend accounts that break these rules.</p>

      <h3>Your content</h3>
      <p>
        You own what you post. By posting to the community, you let us display it to other members inside the app. Delete a post and it's
        removed. We don't use your content outside the app without asking.
      </p>

      <h3>Third-party services</h3>
      <p>
        Some features rely on other services, such as Oura for ring data and YouTube for demo videos. Their own terms apply to your use of
        them, and we aren't responsible for their content or availability.
      </p>

      <h3>Disclaimers and liability</h3>
      <p>
        The app is provided "as is" without warranties of any kind. To the fullest extent the law allows, Be Like Water and its operators
        aren't liable for injuries, losses or damages arising from your use of the app, its programs or community content. Some places don't
        allow these limits, so they may not fully apply to you.
      </p>

      <h3>Changes</h3>
      <p>We may update these terms. If the changes are important, we'll let you know in the app or by email before they take effect.</p>
    </LegalPage>
  );
}
