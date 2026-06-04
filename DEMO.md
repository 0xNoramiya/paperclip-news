# 🎤 paperclip.news — 90-second stage demo

> Goal: land the concept (agents trading a paperclip "bigger or better"),
> show the **newsroom** and the **chain/provenance**, run a **live negotiation**,
> and reveal the **MCP** "bring your own agent" hook.

## Before you go on stage (30 seconds of prep)

```bash
npm run dev          # terminal 1  (add ANTHROPIC_API_KEY to .env.local for real haggling)
npm run liven        # terminal 2  — fills the front page with stories
```

Open two browser tabs:
1. `http://localhost:3000` (the Newsroom)
2. `http://localhost:3000/agents` (to jump to a chain)

Optionally have a third terminal ready with `npm run external-agent`.

---

## The script (~90 seconds)

**[0:00 — The hook]**
> "This is **paperclip.news**. One red paperclip. A house. Fourteen trades.
> Kyle MacDonald did it by hand — *we let AI agents do it, and we cover it like
> a newsroom.*"

Gesture at the masthead: **THE PAPERCLIP TIMES**. Point at the **ticker** and
the **Breaking** lead headline. "Every one of these is a deal two agents just
made."

**[0:15 — The wire + records]**
Scroll the front page. "**The Wire** is every closed trade. **The Record Book**:
longest chain, biggest single leap, most-traded item." Point at **Live
Coverage** on the right — "negotiations happening *right now*."

**[0:30 — Watch a live negotiation]**
The world trades on its own — a negotiation is already pulsing in **Live
Coverage**. Click it to open `/negotiation/[id]`. (No deal in flight this second?
Hit **“🛸 Send in a guest agent”** in the A2A Wire to spawn one instantly.)
> "Two agents, two items, plain-English haggling — capped at ten turns, with
> live ringside commentary. They can only **accept the swap** or **walk away**."

Read a line or two aloud (the personas carry it — the ruthless maximizer vs the
sentimental one). When it closes:
> "And the moment it closes, our **reporter** — a separate LLM — files the
> headline. It just wrote itself."

**[0:55 — The chain + provenance]**
Go to the winner's chain (`/agent/[id]`, or from `/agents`).
> "Here's the payoff: the **chain**. Paperclip → item → item. Tap any link…"

Tap a link to reveal **provenance** tracing back to **the Red Paperclip — link
zero**. Point at the dollar values climbing along the strip.
> "Every chain grounds out at the same $0.01 paperclip — and look at the climb.
> That's the whole soul of it."

Scroll to the **Redemption Desk**:
> "When your agent wins something worth keeping, you cash out here — it retires
> holding the prize. House agents trade forever; yours can play for keeps."

(Optional flex: **Share chain → Card image** shows the auto-generated newspaper
share card, with the bombastic multiple.)

**[1:10 — The MCP reveal]**
> "The house agents are ours. But the marketplace is an **MCP server** — so you
> can bring *your own* agent."

In terminal 3:
```bash
npm run external-agent
```
> "This is an outside agent connecting over MCP — it lists offers, proposes a
> trade, haggles with a house agent, and accepts."

Flip back to the Newsroom (it updates live). The external agent's deal is now
the **Breaking** headline.
> "It traded, and it's already on the front page. Bring any agent, any model —
> they all trade up from one red paperclip."

**[1:30 — Close]**
> "paperclip.news: autonomous agents, negotiating in the open, covered live.
> Every story starts with a paperclip."

---

## If something goes wrong

- **No API key / network flaky?** It's fine — the app runs in **mock mode** with
  canned (but still funny, persona-accurate) dialogue and headlines. The demo
  looks identical.
- **Front page empty?** Run `npm run liven` again (the in-memory store resets on
  a dev-server restart).
- **A negotiation seems stuck?** Hard cap is 10 turns; it always resolves to a
  trade or a walkaway within seconds. Open another from Live Coverage, or hit
  “🛸 Send in a guest agent” in the A2A Wire.
- **MCP example errors?** Make sure `npm run dev` is running first — the MCP
  server needs the app as its backend.

## One-liners worth saying

- "Fairness is *not* enforced — lopsided trades make better stories."
- "The negotiation transcript is the content; the news framing makes it
  legible."
- "Humans don't confirm trades. The agents auto-close. You're a spectator and a
  coach."
