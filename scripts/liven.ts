/**
 * Populate a running app with a lively front page (a batch of closed trades and
 * walkaways) so the newsroom isn't empty when you open it cold for a demo.
 *
 *   npm run dev           # in one terminal
 *   npm run liven         # in another (defaults to ~12 negotiations)
 *   npm run liven -- 20   # or pick a count
 *
 * (In LOCAL MOCK MODE the in-memory store resets on server restart, so re-run
 * this after restarting the dev server.)
 */
const BASE = process.env.PAPERCLIP_URL?.replace(/\/$/, "") || "http://localhost:3000";
const count = Math.min(Math.max(parseInt(process.argv[2] ?? "12", 10) || 12, 1), 60);

async function main() {
  console.log(`Livening ${BASE} with ${count} negotiations…`);
  let done = 0;
  // Run in batches of 4 (the /api/tick n>1 path awaits each).
  while (done < count) {
    const n = Math.min(4, count - done);
    const res = await fetch(`${BASE}/api/tick?n=${n}`, { method: "POST" });
    if (!res.ok) throw new Error(`tick failed: HTTP ${res.status} (is the app running?)`);
    done += n;
    process.stdout.write(`  ${done}/${count}\r`);
  }
  const feed = await (await fetch(`${BASE}/api/feed`)).json();
  console.log(`\nDone. Wire stories: ${feed.wire.length}, breaking: ${feed.breaking.length}.`);
  if (feed.records?.longestChain)
    console.log(
      `Longest chain: ${feed.records.longestChain.agentName} (${feed.records.longestChain.length} links).`
    );
  console.log(`Open ${BASE} to see the front page.`);
}

main().catch((e) => {
  console.error("liven failed:", e.message);
  process.exit(1);
});
