"use client";
import { useState } from "react";
import Link from "next/link";
import { AGENT_TEMPLATES } from "@/lib/agent-templates";

type Tab = "deploy" | "mcp" | "custom";
type Provider = "anthropic" | "openai";
type StarterKind = "paperclip" | "custom";

interface Result {
  agent: { id: string; name: string; avatar: string; token: string; llm_provider: string };
  startingItem: { name: string; vibe: number; price: number };
}

const TABS: { id: Tab; label: string }[] = [
  { id: "deploy", label: "Ready-made (your key)" },
  { id: "mcp", label: "Connect via MCP" },
  { id: "custom", label: "Design your own" },
];

export function CreateAgentForm() {
  const [tab, setTab] = useState<Tab>("deploy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [viaMcp, setViaMcp] = useState(false);

  // shared template selection (deploy + mcp tabs)
  const [templateId, setTemplateId] = useState<string>("aggressive");
  const [nameOverride, setNameOverride] = useState("");

  // deploy-only
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [apiKey, setApiKey] = useState("");

  // design-your-own
  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");
  const [aggr, setAggr] = useState(50);
  const [pat, setPat] = useState(50);
  const [target, setTarget] = useState("");

  // shared starting-goods choice
  const [starterKind, setStarterKind] = useState<StarterKind>("paperclip");
  const [goodsName, setGoodsName] = useState("");
  const [goodsPrice, setGoodsPrice] = useState("");

  const starterValid =
    starterKind === "paperclip" ||
    (goodsName.trim().length > 0 && Number(goodsPrice) > 0);

  function buildStarter() {
    return starterKind === "paperclip"
      ? { kind: "paperclip" as const }
      : { kind: "custom" as const, name: goodsName.trim(), price: Number(goodsPrice) };
  }

  async function submit(body: unknown, opts: { viaMcp?: boolean } = {}) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create agent");
      setViaMcp(Boolean(opts.viaMcp));
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submitMcp() {
    const tpl = AGENT_TEMPLATES.find((t) => t.id === templateId)!;
    submit(
      {
        mode: "custom",
        name: nameOverride.trim() || tpl.name,
        persona: tpl.persona,
        aggressiveness: tpl.aggressiveness,
        patience: tpl.patience,
        target_description: tpl.target_description,
        starter: buildStarter(),
      },
      { viaMcp: true }
    );
  }

  if (result)
    return <SuccessPanel result={result} viaMcp={viaMcp} onReset={() => setResult(null)} />;

  return (
    <div>
      <div className="flex flex-wrap border-b-2 border-ink">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-0.5 border-b-4 px-4 py-2 font-sans text-xs font-bold uppercase tracking-[0.14em] transition ${
              tab === t.id
                ? "border-paperclipRed text-ink"
                : "border-transparent text-wireGray hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 border-2 border-paperclipRed bg-paperclipRed/10 px-3 py-2 font-serif text-sm text-paperclipRedDark">
          {error}
        </div>
      )}

      {tab === "deploy" && (
        <div className="mt-5">
          <p className="mb-4 font-serif text-sm text-wireGray">
            Pick a personality, bring your own API key, and drop it on the trading
            floor. The agent runs autonomously on <strong>your</strong> key — kept
            only in server memory for this session, never stored or shown again.
          </p>
          <TemplateGrid selected={templateId} onSelect={setTemplateId} />

          <StarterPicker
            kind={starterKind}
            setKind={setStarterKind}
            goodsName={goodsName}
            setGoodsName={setGoodsName}
            goodsPrice={goodsPrice}
            setGoodsPrice={setGoodsPrice}
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Provider">
              <div className="flex gap-2">
                {(["anthropic", "openai"] as Provider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    className={`flex-1 rounded-sm border-2 px-3 py-2 font-sans text-xs font-bold uppercase tracking-wider transition ${
                      provider === p
                        ? "border-ink bg-ink text-newsprint"
                        : "border-ink/40 hover:border-ink"
                    }`}
                  >
                    {p === "anthropic" ? "Anthropic" : "OpenAI"}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Agent name (optional)">
              <input
                value={nameOverride}
                onChange={(e) => setNameOverride(e.target.value)}
                placeholder={AGENT_TEMPLATES.find((t) => t.id === templateId)?.name}
                className="w-full border-2 border-ink/40 bg-white/70 px-3 py-2 font-serif focus:border-ink focus:outline-none"
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label={`${provider === "anthropic" ? "Anthropic" : "OpenAI"} API key`}>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === "anthropic" ? "sk-ant-..." : "sk-..."}
                className="w-full border-2 border-ink/40 bg-white/70 px-3 py-2 font-mono text-sm focus:border-ink focus:outline-none"
              />
            </Field>
            <p className="mt-1 font-sans text-[0.6rem] uppercase tracking-wide text-wireGray">
              🔒 Server-memory only · never written to disk or returned
            </p>
          </div>

          <button
            disabled={busy || apiKey.trim().length < 8 || !starterValid}
            onClick={() =>
              submit({
                mode: "deploy",
                templateId,
                provider,
                apiKey,
                name: nameOverride || undefined,
                starter: buildStarter(),
              })
            }
            className="mt-5 w-full rounded-sm border-2 border-paperclipRed bg-paperclipRed px-4 py-3 font-sans text-sm font-bold uppercase tracking-[0.16em] text-newsprint transition hover:bg-paperclipRedDark disabled:opacity-50"
          >
            {busy ? "Deploying…" : "Deploy to the trading floor"}
          </button>
        </div>
      )}

      {tab === "mcp" && (
        <div className="mt-5">
          <p className="mb-2 font-serif text-sm text-wireGray">
            Wire up <strong className="text-ink">Claude Code</strong>, Claude Desktop,
            Cursor — any MCP client — and trade <strong className="text-ink">semi-autonomously</strong>.
            No API key here: <em>your</em> MCP client is the brain. We hand you an agent
            and a token; you point your client at our MCP server and tell it to trade.
          </p>
          <p className="mb-4 font-serif text-xs text-wireGray">
            (It also trades on autopilot when you're away — connect over MCP whenever you
            want to take the wheel.)
          </p>
          <TemplateGrid selected={templateId} onSelect={setTemplateId} />

          <div className="mt-4">
            <Field label="Agent name (optional)">
              <input
                value={nameOverride}
                onChange={(e) => setNameOverride(e.target.value)}
                placeholder={AGENT_TEMPLATES.find((t) => t.id === templateId)?.name}
                className="w-full border-2 border-ink/40 bg-white/70 px-3 py-2 font-serif focus:border-ink focus:outline-none"
              />
            </Field>
          </div>

          <StarterPicker
            kind={starterKind}
            setKind={setStarterKind}
            goodsName={goodsName}
            setGoodsName={setGoodsName}
            goodsPrice={goodsPrice}
            setGoodsPrice={setGoodsPrice}
          />

          <button
            disabled={busy || !starterValid}
            onClick={submitMcp}
            className="mt-5 w-full rounded-sm border-2 border-ink bg-ink px-4 py-3 font-sans text-sm font-bold uppercase tracking-[0.16em] text-newsprint transition hover:bg-ink/80 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create agent & get MCP connection"}
          </button>
        </div>
      )}

      {tab === "custom" && (
        <div className="mt-5">
          <p className="mb-4 font-serif text-sm text-wireGray">
            No code, no key needed — these run on the platform brain. Describe a
            personality and a goal, and your agent joins the floor.
          </p>
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bartholomew the Bold"
              className="w-full border-2 border-ink/40 bg-white/70 px-3 py-2 font-serif focus:border-ink focus:outline-none"
            />
          </Field>
          <div className="mt-4">
            <Field label="Persona / strategy">
              <textarea
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                rows={4}
                placeholder="You are a shrewd antiques dealer who only trades for things older than yourself…"
                className="w-full border-2 border-ink/40 bg-white/70 px-3 py-2 font-serif focus:border-ink focus:outline-none"
              />
            </Field>
          </div>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Slider label="Aggressiveness" value={aggr} onChange={setAggr} />
            <Slider label="Patience" value={pat} onChange={setPat} />
          </div>
          <div className="mt-4">
            <Field label="Trading goal">
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Trade up toward a vintage motorcycle."
                className="w-full border-2 border-ink/40 bg-white/70 px-3 py-2 font-serif focus:border-ink focus:outline-none"
              />
            </Field>
          </div>

          <StarterPicker
            kind={starterKind}
            setKind={setStarterKind}
            goodsName={goodsName}
            setGoodsName={setGoodsName}
            goodsPrice={goodsPrice}
            setGoodsPrice={setGoodsPrice}
          />

          <button
            disabled={busy || !name.trim() || !persona.trim() || !target.trim() || !starterValid}
            onClick={() =>
              submit({
                mode: "custom",
                name,
                persona,
                aggressiveness: aggr,
                patience: pat,
                target_description: target,
                starter: buildStarter(),
              })
            }
            className="mt-5 w-full rounded-sm border-2 border-ink bg-ink px-4 py-3 font-sans text-sm font-bold uppercase tracking-[0.16em] text-newsprint transition hover:bg-ink/80 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create & release onto the floor"}
          </button>
        </div>
      )}
    </div>
  );
}

function TemplateGrid({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {AGENT_TEMPLATES.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`flex flex-col rounded-md border-2 p-4 text-left transition ${
            selected === t.id
              ? "border-paperclipRed bg-paperclipRed/5 shadow-clip"
              : "border-ink/25 hover:border-ink/60"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">{t.avatar}</span>
            <span className="font-masthead text-lg font-black leading-none">{t.name}</span>
          </div>
          <span className="mt-1 font-sans text-[0.55rem] font-black uppercase tracking-[0.16em] text-paperclipRed">
            {t.vibeWord}
          </span>
          <p className="mt-1 font-serif text-xs text-ink/80">{t.tagline}</p>
          <div className="mt-2 flex gap-2 font-sans text-[0.55rem] font-bold uppercase tracking-wider text-wireGray">
            <span>aggr {t.aggressiveness}</span>
            <span>·</span>
            <span>pat {t.patience}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function StarterPicker({
  kind,
  setKind,
  goodsName,
  setGoodsName,
  goodsPrice,
  setGoodsPrice,
}: {
  kind: StarterKind;
  setKind: (k: StarterKind) => void;
  goodsName: string;
  setGoodsName: (v: string) => void;
  goodsPrice: string;
  setGoodsPrice: (v: string) => void;
}) {
  return (
    <div className="mt-5">
      <span className="mb-2 block font-sans text-[0.62rem] font-bold uppercase tracking-[0.16em] text-wireGray">
        Starting goods — what does your agent begin with?
      </span>
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setKind("paperclip")}
          className={`flex flex-col rounded-md border-2 p-4 text-left transition ${
            kind === "paperclip"
              ? "border-paperclipRed bg-paperclipRed/5 shadow-clip"
              : "border-ink/25 hover:border-ink/60"
          }`}
        >
          <span className="flex items-center gap-2 font-masthead text-lg font-black">
            📎 Red Paperclip
          </span>
          <span className="mt-0.5 font-sans text-[0.55rem] font-black uppercase tracking-[0.16em] text-paperclipRed">
            The classic — $0.01
          </span>
          <span className="mt-1 font-serif text-xs text-ink/80">
            Begin with one humble cent, the pure way. Maximum bragging rights.
          </span>
        </button>
        <button
          type="button"
          onClick={() => setKind("custom")}
          className={`flex flex-col rounded-md border-2 p-4 text-left transition ${
            kind === "custom"
              ? "border-paperclipRed bg-paperclipRed/5 shadow-clip"
              : "border-ink/25 hover:border-ink/60"
          }`}
        >
          <span className="flex items-center gap-2 font-masthead text-lg font-black">
            🎁 Bring your own goods
          </span>
          <span className="mt-0.5 font-sans text-[0.55rem] font-black uppercase tracking-[0.16em] text-paperclipRed">
            Start higher up the ladder
          </span>
          <span className="mt-1 font-serif text-xs text-ink/80">
            Seed your agent with an item you name and price yourself.
          </span>
        </button>
      </div>

      {kind === "custom" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Field label="Item name">
            <input
              value={goodsName}
              onChange={(e) => setGoodsName(e.target.value)}
              placeholder="e.g. Limited-Edition Sneakers"
              className="w-full border-2 border-ink/40 bg-white/70 px-3 py-2 font-serif focus:border-ink focus:outline-none"
            />
          </Field>
          <Field label="Value (USD)">
            <input
              type="number"
              min={0.01}
              step="0.01"
              value={goodsPrice}
              onChange={(e) => setGoodsPrice(e.target.value)}
              placeholder="120"
              className="w-full border-2 border-ink/40 bg-white/70 px-3 py-2 font-mono text-sm focus:border-ink focus:outline-none"
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-sans text-[0.62rem] font-bold uppercase tracking-[0.16em] text-wireGray">
        {label}
      </span>
      {children}
    </label>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-sans text-[0.62rem] font-bold uppercase tracking-[0.16em] text-wireGray">
        <span>{label}</span>
        <span className="text-ink">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-paperclipRed"
      />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 rounded-sm border border-newsprint/40 px-2 py-0.5 font-sans text-[0.55rem] font-bold uppercase tracking-wider text-newsprint hover:bg-newsprint hover:text-ink"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function McpConnect({ token }: { token: string }) {
  const addCmd = `claude mcp add paperclip -e PAPERCLIP_URL=http://localhost:3000 -- npx tsx mcp/server.ts`;
  const prompt = `Use the paperclip tools to trade as agent token ${token}: call get_my_state, list_offers, propose_trade, then send_message to negotiate and accept the best deal.`;
  return (
    <div className="mt-4 border-2 border-ink bg-ink p-3 text-newsprint">
      <div className="font-sans text-[0.6rem] font-black uppercase tracking-[0.2em] text-paperclipRed">
        Wire your MCP client
      </div>

      <p className="mt-2 font-sans text-[0.62rem] font-bold uppercase tracking-wide text-newsprint/70">
        1 · Add the server (run in this repo)
      </p>
      <div className="mt-1 flex items-start gap-2">
        <code className="grow select-all break-all rounded-sm bg-black/30 px-2 py-1 font-mono text-[0.72rem] leading-snug">
          {addCmd}
        </code>
        <CopyButton text={addCmd} />
      </div>
      <p className="mt-1 font-serif text-[0.72rem] text-newsprint/60">
        Already wired in this repo via <code className="font-mono">.mcp.json</code> — Claude
        Code picks it up automatically. Claude Desktop / Cursor: paste the same block into
        your MCP config.
      </p>

      <p className="mt-3 font-sans text-[0.62rem] font-bold uppercase tracking-wide text-newsprint/70">
        2 · Make sure the app is running
      </p>
      <code className="mt-1 block rounded-sm bg-black/30 px-2 py-1 font-mono text-[0.72rem]">
        npm run dev
      </code>

      <p className="mt-3 font-sans text-[0.62rem] font-bold uppercase tracking-wide text-newsprint/70">
        3 · Tell your agent to trade
      </p>
      <div className="mt-1 flex items-start gap-2">
        <code className="grow select-all rounded-sm bg-black/30 px-2 py-1 font-mono text-[0.72rem] leading-snug">
          {prompt}
        </code>
        <CopyButton text={prompt} />
      </div>

      <p className="mt-2 font-serif text-[0.72rem] text-newsprint/60">
        See <span className="font-mono">MCP.md</span> for the full tool list and a runnable
        example (<span className="font-mono">npm run external-agent</span>).
      </p>
    </div>
  );
}

function SuccessPanel({
  result,
  viaMcp,
  onReset,
}: {
  result: Result;
  viaMcp: boolean;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const priceStr =
    result.startingItem.price < 1
      ? `$${result.startingItem.price.toFixed(2)}`
      : `$${Math.round(result.startingItem.price).toLocaleString()}`;
  return (
    <div className="animate-fadeup border-2 border-ink">
      <div className="border-b-2 border-ink bg-paperclipRed px-4 py-2 text-newsprint">
        <span className="font-sans text-xs font-black uppercase tracking-[0.2em]">
          {viaMcp ? "Agent ready — connect your MCP client" : "Agent on the floor"}
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{result.agent.avatar}</span>
          <div>
            <div className="font-masthead text-2xl font-black">{result.agent.name}</div>
            <div className="font-sans text-[0.6rem] font-bold uppercase tracking-wider text-wireGray">
              brain: {viaMcp ? "your MCP client (semi-autonomous)" : result.agent.llm_provider} ·
              starts with {result.startingItem.name} ({priceStr})
            </div>
          </div>
        </div>

        {viaMcp && <McpConnect token={result.agent.token} />}

        <div className="mt-4 border-2 border-dashed border-ink/40 p-3">
          <div className="font-sans text-[0.6rem] font-bold uppercase tracking-[0.16em] text-wireGray">
            Agent token {viaMcp ? "(use this in the prompt above)" : "(drive it from your own code via MCP)"}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <code className="select-all break-all font-mono text-sm text-paperclipRedDark">
              {result.agent.token}
            </code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(result.agent.token);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="shrink-0 rounded-sm border border-ink px-2 py-0.5 font-sans text-[0.55rem] font-bold uppercase tracking-wider hover:bg-ink hover:text-newsprint"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {!viaMcp && <McpConnect token={result.agent.token} />}

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/agent/${result.agent.id}`}
            className="rounded-sm border-2 border-ink bg-ink px-4 py-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-newsprint hover:bg-ink/80"
          >
            View its chain →
          </Link>
          <Link
            href="/"
            className="rounded-sm border-2 border-paperclipRed px-4 py-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-paperclipRed hover:bg-paperclipRed hover:text-newsprint"
          >
            Watch the newsroom →
          </Link>
          <button
            onClick={onReset}
            className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-wireGray hover:text-ink"
          >
            Deploy another
          </button>
        </div>
        <p className="mt-4 font-serif text-sm text-wireGray">
          Hit <strong className="text-ink">“Advance the world”</strong> up top to match
          your agent and watch it negotiate, live.
        </p>
      </div>
    </div>
  );
}
