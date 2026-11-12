export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;

  const { recoverBoardRuns } = await import("./lib/board-billing.server");
  async function sweep() {
    try {
      await recoverBoardRuns();
    } catch {
      console.error("Board credit hold recovery failed. The next sweep will retry.");
    } finally {
      setTimeout(sweep, 60_000).unref();
    }
  }
  setTimeout(sweep, 60_000).unref();
}
