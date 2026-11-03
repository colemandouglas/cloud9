// Transactional email through Resend's HTTP API. Without RESEND_API_KEY the
// message is printed to the server log instead, which is fine for local dev
// and for a private beta where the admin can read the logs.

const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "Be Like Water <hello@example.com>";
export const emailConfigured = !!KEY;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function layout(heading, body, cta) {
  return `<!doctype html><html><body style="margin:0;background:#EDF2F0;font-family:Helvetica,Arial,sans-serif;color:#16201E">
  <div style="max-width:520px;margin:0 auto;padding:28px 20px">
    <div style="background:#1F3A33;color:#F2F7F6;border-radius:14px 14px 0 0;padding:20px 24px;font-size:22px;font-weight:700">Be Like Water</div>
    <div style="background:#fff;border-radius:0 0 14px 14px;padding:24px">
      <h1 style="font-size:22px;margin:0 0 12px">${esc(heading)}</h1>
      <div style="font-size:16px;line-height:1.55;color:#33403C">${body}</div>
      ${cta ? `<p style="margin:24px 0 8px"><a href="${esc(cta.url)}" style="background:#1F3A33;color:#F2F7F6;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>` : ""}
    </div>
    <p style="font-size:12px;color:#56635F;margin-top:16px">Beta. Programs are general guidance, not medical advice. In an emergency, call 911.</p>
  </div></body></html>`;
}

export async function sendEmail({ to, subject, heading, body, cta }) {
  if (!KEY) {
    console.log(`\n[email to ${to}] ${subject}${cta ? `\n  ${cta.label}: ${cta.url}` : ""}\n`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html: layout(heading, body, cta) }),
    });
    if (!res.ok) console.error(`Email to ${to} failed: ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error(`Email to ${to} failed:`, err.message);
  }
}

export { esc as escapeHtml };
