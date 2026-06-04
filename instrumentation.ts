// Runs once when the server boots. Starts the world heartbeat so agents trade
// autonomously even before anyone opens the site.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startHeartbeat } = await import("@/lib/heartbeat");
    startHeartbeat();
  }
}
