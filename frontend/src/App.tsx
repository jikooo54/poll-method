import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { ChartBar, Scales, CheckCircle, XCircle, WarningCircle, PlusCircle, ListChecks } from "@phosphor-icons/react";
import { Hero3D } from "./Hero3D";
import { BgGeo } from "./BgGeo";
import { submitPoll, audit, certify, getTicket, getCounts, listAll, TicketView, TicketRow, Verdict } from "./contractService";

type Hex = `0x${string}`;
const STATUS_LABEL = ["submitted", "audited", "certified"];
function shortAddr(a: string): string { return a && a.length > 12 ? `${a.slice(0, 6)}\u2026${a.slice(-4)}` : a || "-"; }
function vColor(v: Verdict | string): string { return v === "ROBUST" ? "#16a34a" : v === "BRITTLE" ? "#d97706" : v === "FRAGILE" ? "#dc2626" : "var(--dim, #888)"; }

export function App() {
  const { address, isConnected } = useAccount();
  const acct = address as Hex | undefined;
  const [showSub, setShowSub] = useState(false);
  const [pollster, setPollster] = useState(""); const [topic, setTopic] = useState(""); const [headline, setHeadline] = useState(""); const [meth, setMeth] = useState("");
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [counts, setCounts] = useState({ next: 0, audited: 0, robust: 0 });
  const [selId, setSelId] = useState<number | null>(null); const [sel, setSel] = useState<TicketView | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState<string | null>(null); const [note, setNote] = useState(""); const [netErr, setNetErr] = useState(false);

  async function refreshAll() { if (typeof document !== "undefined" && document.hidden) return; try { const [c, l] = await Promise.all([getCounts(), listAll(80)]); setCounts(c); setRows(l); if (selId != null) { try { setSel(await getTicket(selId)); } catch {} } setNetErr(false); } catch { setNetErr(true); } finally { setLoading(false); } }
  useEffect(() => { refreshAll(); const t = setInterval(refreshAll, 12000); const onVis = () => { if (!document.hidden) refreshAll(); }; document.addEventListener("visibilitychange", onVis); return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function pick(id: number) { setSelId(id); try { setSel(await getTicket(id)); } catch { setSel(null); } }
  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> { setBusy(label); setNote(""); try { return await fn(); } catch (e) { setNote(String((e as Error).message || e).slice(0, 200)); return undefined; } finally { setBusy(null); refreshAll(); } }
  async function onSub() { if (!acct) return; if (pollster.trim().length < 2) return setNote("Pollster required."); if (topic.trim().length < 2) return setNote("Topic required."); if (headline.trim().length < 8) return setNote("Headline conclusion required."); if (meth.trim().length < 30) return setNote("Methodology 30+ chars."); const id = await run("Submitting poll", () => submitPoll(acct!, pollster, topic, headline, meth)); if (id != null) { setSelId(id); setPollster(""); setTopic(""); setHeadline(""); setMeth(""); setShowSub(false); } }
  async function onAudit() { if (acct && selId != null) await run("Sensitivity sweep (extract + simulate)", () => audit(acct!, selId!)); }
  async function onCertify() { if (acct && selId != null) await run("Certifying result", () => certify(acct!, selId!)); }

  const robustRate = useMemo(() => counts.audited > 0 ? Math.round((counts.robust / counts.audited) * 100) : 0, [counts]);
  const resFor = (sv: TicketView, name: string) => sv.survivalResults.find(r => r.alt_name === name);

  return (
    <div className="fs">
      <BgGeo />
      <div className="top">
        <div className="brand"><b>CROSSTAB</b><span>sensitivity sweep</span></div>
        <div className="top-r"><span className={`live ${netErr ? "off" : ""}`}><i />{netErr ? "reconnecting" : "studionet"}</span><ConnectButton showBalance={false} chainStatus="none" accountStatus="address" /></div>
      </div>

      <section className="hero">
        <Hero3D />
        <div className="hero-in">
          <p className="eyebrow">poll robustness audit</p>
          <h1>Does the headline <em>survive</em><br />a re-weighting?</h1>
          <p className="lede">A two-pass GenLayer panel extracts the poll's weighting scheme, proposes five defensible re-weightings, and re-runs the headline under each. The survival rate yields a ROBUST / BRITTLE / FRAGILE verdict.</p>
          <p className="src">Methodology on-chain, swept by validators via <code>gl.nondet</code>.</p>
        </div>
      </section>

      <div className="stats">
        <div className="stat"><b>{counts.next}</b><span>polls</span></div>
        <div className="stat"><b>{counts.audited}</b><span>audited</span></div>
        <div className="stat"><b>{counts.robust}</b><span>robust</span></div>
        <div className="stat"><b>{robustRate}<i>%</i></b><span>robust rate</span></div>
      </div>

      <div className="sec-h"><ListChecks size={15} weight="bold" /><h2>Rulings</h2><span className="mut">submit / audit / certify</span></div>
      {loading ? <div className="skel">{[0, 1, 2].map(i => <div key={i} className="sk" />)}</div>
        : rows.length === 0 ? <div className="empty">No polls submitted yet.</div>
          : <div className="mkts">{rows.map(r => (
            <button key={r.id} className={`mkt ${selId === r.id ? "on" : ""}`} onClick={() => pick(r.id)}>
              <div className="mkt-h"><span className="mkt-q">{r.pollster} · {r.topic}</span><span className="tag" style={{ color: vColor(r.verdict), borderColor: "currentColor" }}>{r.verdict || STATUS_LABEL[r.status]}</span></div>
              <div className="mkt-meta">{r.status >= 1 ? <span className="mono">survival {r.survivalPct}%</span> : null}{r.status >= 1 ? <span className="mono">{r.alternatives.length} re-weightings</span> : null}<span className="mono">{shortAddr(r.submitter)}</span></div>
            </button>))}</div>}

      {sel && selId != null && (
        <div className="panel">
          <div className="sec-h" style={{ marginTop: 0 }}><Scales size={15} weight="bold" /><h2>{sel.topic}</h2><span className="tag" style={{ color: vColor(sel.verdict), borderColor: "currentColor" }}>{sel.verdict || STATUS_LABEL[sel.status]}</span></div>
          <div className="kv"><span>headline conclusion</span><b>{sel.headlineConclusion}</b></div>
          {sel.status >= 1 && (
            <div className="surv" style={{ borderColor: vColor(sel.verdict) }}>
              <div className="surv-pct" style={{ color: vColor(sel.verdict) }}>{sel.survivalPct}<i>%</i></div>
              <div className="surv-l"><b style={{ color: vColor(sel.verdict) }}>{sel.verdict}</b><span>{sel.survivalResults.filter(r => r.conclusion_holds).length} of {sel.alternatives.length} re-weightings preserve the conclusion</span></div>
            </div>
          )}
          {Object.keys(sel.weightingScheme).length > 0 && (
            <div className="evid"><div className="l">extracted weighting scheme</div>
              <div className="scheme">{Object.entries(sel.weightingScheme).map(([k, v]) => (<div className="srow" key={k}><span className="sk2">{k}</span><span className="sv mono">{v}</span></div>))}</div>
            </div>
          )}
          {sel.alternatives.length > 0 && (
            <div className="alts">{sel.alternatives.map((a, i) => { const r = resFor(sel, a.name); const holds = !!r?.conclusion_holds; return (
              <div className="alt" key={i}>
                <div className="alt-h"><span className="alt-n">{a.name}</span>{sel.status >= 1 ? <span className={`altb ${holds ? "ok" : "no"}`}>{holds ? <CheckCircle size={14} weight="fill" /> : <XCircle size={14} weight="fill" />}{holds ? "holds" : "flips"}{r ? <em>{r.margin_shift > 0 ? "+" : ""}{r.margin_shift} pts</em> : null}</span> : null}</div>
                {a.justification ? <p className="alt-j">{a.justification}</p> : null}
                {Object.keys(a.weights).length > 0 ? <div className="alt-w mono">{Object.entries(a.weights).map(([k, v]) => `${k}:${v}`).join("  ")}</div> : null}
              </div>
            ); })}</div>
          )}
          {sel.rationale && <p className="why">{sel.rationale}</p>}
          {sel.methodology && <div className="evid"><div className="l">methodology</div><pre>{sel.methodology}</pre></div>}
          <div className="actions">
            {sel.status === 0 && <button className="btn" disabled={!isConnected || !!busy} onClick={onAudit}><ChartBar size={15} weight="bold" /> Run sensitivity sweep</button>}
            {sel.status === 1 && <button className="btn" disabled={!isConnected || !!busy} onClick={onCertify}><CheckCircle size={15} weight="bold" /> Certify result</button>}
            {sel.status === 2 && <p className="quiet"><CheckCircle size={15} weight="fill" /> Certified. {sel.verdict} at {sel.survivalPct}% survival.</p>}
          </div>
        </div>
      )}

      <div className="sec-h"><PlusCircle size={15} weight="bold" /><h2>Submit a poll</h2></div>
      {!showSub ? <button className="btn ghost" onClick={() => setShowSub(true)}><PlusCircle size={15} weight="bold" /> New poll</button>
        : <div className="panel">
          <label>Pollster</label><input value={pollster} onChange={e => setPollster(e.target.value)} placeholder="polling house / outlet" />
          <label>Topic</label><input value={topic} onChange={e => setTopic(e.target.value)} placeholder="poll topic" />
          <label>Headline conclusion</label><input value={headline} onChange={e => setHeadline(e.target.value)} placeholder="e.g. Candidate A leads by 6 points" />
          <label>Methodology (30+ chars)</label><textarea value={meth} onChange={e => setMeth(e.target.value)} placeholder="Sample size, frame, weighting variables, mode, dates, sponsor." />
          <button className="btn" disabled={!isConnected || !!busy} onClick={onSub}>{isConnected ? "Submit for sweep" : "Connect a wallet"}</button>
        </div>}

      {netErr && <div className="strip"><WarningCircle size={14} weight="bold" /> Lost the studionet read; retrying every 12s.</div>}
      <div className="foot"><span>Crosstab · on studionet</span><span>{netErr ? "reconnecting" : "live"}</span></div>
      {(busy || note) && <div className="toast">{busy ? `${busy}\u2026` : note}</div>}
    </div>
  );
}
