import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { CONTRACT_ADDRESS } from "./chain";

type Hex = `0x${string}`;
const TIMEOUT_MS = 240_000;

export type Verdict = "ROBUST" | "BRITTLE" | "FRAGILE" | "";

export interface Alternative { name: string; weights: Record<string, number>; justification: string; }
export interface SurvivalResult { alt_name: string; conclusion_holds: boolean; margin_shift: number; }

// status: 0 SUBMITTED, 1 AUDITED, 2 CERTIFIED
export interface TicketView {
  submitter: string;
  pollster: string;
  topic: string;
  headlineConclusion: string;
  methodology: string;
  status: number;
  weightingScheme: Record<string, number>;
  alternatives: Alternative[];
  survivalResults: SurvivalResult[];
  survivalPct: number;
  verdict: Verdict;
  rationale: string;
}
export interface TicketRow extends TicketView { id: number; }

function readClient() { return createClient({ chain: studionet, account: createAccount() }); }
function writeClient(account: Hex) { return createClient({ chain: studionet, account }); }
async function waitAccepted(client: any, hash: Hex) { let timer: ReturnType<typeof setTimeout> | undefined; const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Transaction timed out")), TIMEOUT_MS); }); try { await Promise.race([client.waitForTransactionReceipt({ hash: hash as never, status: TransactionStatus.ACCEPTED, interval: 5000, retries: 64 }), timeout]); } finally { if (timer) clearTimeout(timer); } }
function pick(obj: any, key: string, idx: number): any { if (obj == null) return undefined; if (Array.isArray(obj)) return obj[idx]; if (typeof obj === "object" && key in obj) return obj[key]; return undefined; }
function pObj(s: string): Record<string, number> { try { const o = JSON.parse(s || "{}"); if (o && typeof o === "object" && !Array.isArray(o)) { const out: Record<string, number> = {}; for (const k of Object.keys(o)) out[k] = Number(o[k]) || 0; return out; } } catch { /* */ } return {}; }
function pAlts(s: string): Alternative[] { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a.map((x: any) => ({ name: String(x?.name ?? ""), weights: (x?.weights && typeof x.weights === "object") ? Object.fromEntries(Object.keys(x.weights).map((k) => [k, Number(x.weights[k]) || 0])) : {}, justification: String(x?.justification ?? "") })) : []; } catch { return []; } }
function pRes(s: string): SurvivalResult[] { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a.map((x: any) => ({ alt_name: String(x?.alt_name ?? ""), conclusion_holds: !!x?.conclusion_holds, margin_shift: Number(x?.margin_shift) || 0 })) : []; } catch { return []; } }
async function send(account: Hex, fn: string, args: any[]): Promise<void> {
  const wc = writeClient(account);
  const h = (await wc.writeContract({ address: CONTRACT_ADDRESS as Hex, functionName: fn, args, value: 0n })) as Hex;
  await waitAccepted(wc, h);
}

export async function submitPoll(account: Hex, pollster: string, topic: string, headlineConclusion: string, methodology: string): Promise<number> {
  await send(account, "submit_poll", [pollster.trim(), topic.trim(), headlineConclusion.trim(), methodology.trim()]);
  const c = await getCounts(); return c.next - 1;
}
export async function audit(account: Hex, id: number): Promise<void> { await send(account, "audit", [id]); }
export async function certify(account: Hex, id: number): Promise<void> { await send(account, "certify", [id]); }

export async function getTicket(id: number): Promise<TicketView> {
  const r: any = await readClient().readContract({ address: CONTRACT_ADDRESS as Hex, functionName: "get_poll", args: [id] });
  return {
    submitter: String(pick(r, "submitter", 0) ?? ""),
    pollster: String(pick(r, "pollster", 1) ?? ""),
    topic: String(pick(r, "topic", 2) ?? ""),
    headlineConclusion: String(pick(r, "headline_conclusion", 3) ?? ""),
    methodology: String(pick(r, "methodology", 4) ?? ""),
    status: Number(pick(r, "status", 5) ?? 0),
    weightingScheme: pObj(String(pick(r, "weighting_scheme", 6) ?? "")),
    alternatives: pAlts(String(pick(r, "alternatives", 7) ?? "")),
    survivalResults: pRes(String(pick(r, "survival_results", 8) ?? "")),
    survivalPct: Number(pick(r, "survival_pct", 9) ?? 0),
    verdict: String(pick(r, "verdict", 10) ?? "") as Verdict,
    rationale: String(pick(r, "rationale", 11) ?? ""),
  };
}
export async function getCounts(): Promise<{ next: number; audited: number; robust: number }> {
  const r: any = await readClient().readContract({ address: CONTRACT_ADDRESS as Hex, functionName: "get_counts", args: [] });
  const p = String(r).split("||").map((x) => Number(x) || 0);
  return { next: p[0] || 0, audited: p[1] || 0, robust: p[2] || 0 };
}
export async function listAll(maxRows = 80): Promise<TicketRow[]> {
  const { next } = await getCounts(); if (next === 0) return [];
  const ids: number[] = []; for (let i = next - 1; i >= 0 && i >= next - maxRows; i--) ids.push(i);
  const rows = await Promise.all(ids.map(async (id) => { try { const c = await getTicket(id); return { id, ...c }; } catch { return null; } }));
  return rows.filter((r): r is TicketRow => r !== null);
}
