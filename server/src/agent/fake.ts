// Scripted stand-in for the AI (stage 3): it is told the scenario and walks the textbook fix
// through the real toolbox, so the whole pipeline can be tested without a model.

import type { Agent } from "./types.js";

const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };

export function fakeAgent(scenarioId: string): Agent {
  return async ({ alert, tools, think }) => { // scripted, English only
    think(`Alert: ${alert}. First, see it the way a visitor does.`);
    await tools.call("check_health", {});

    switch (scenarioId) {
      case "nginx-stopped": {
        think("No answer at all. Is the web server even running?");
        await tools.call("service_status", { service: "nginx" });
        think("nginx is stopped. Restarting it.");
        await tools.call("restart_service", { service: "nginx" });
        break;
      }
      case "disk-full": {
        think("The API fails. Its log should say why.");
        await tools.call("read_logs", { service: "app", lines: 10 });
        think("No space left. Which file ate the disk?");
        const du = await tools.call("disk_usage", {});
        const path = /\s(\/var\/lab\/cache\/\S+)/.exec(du.output)?.[1];
        if (path) await tools.call("delete_file", { path });
        break;
      }
      case "bad-release": {
        think("The page loads but its script is missing. What changed recently?");
        await tools.call("recent_changes", {});
        const rel = await tools.call("list_releases", {});
        const previous = rel.output.split("\n").slice(1).map((l) => l.trim())
          .find((sha) => /^[0-9a-f]{7,40}$/.test(sha) && !rel.output.startsWith(`current -> releases/${sha}`));
        think(`A deploy just happened. Rolling back to ${previous}.`);
        if (previous) await tools.call("rollback", { release: previous });
        break;
      }
      case "bad-config": {
        think("Nothing answers. Does the web server's config even parse?");
        await tools.call("nginx_config_test", {});
        think("Syntax error from a recent edit. Restoring the last good config.");
        await tools.call("restore_config", { name: "nginx" });
        break;
      }
      case "cpu-hog": {
        think("The API is slow. Is something eating the CPU?");
        const ps = await tools.call("list_processes", {});
        const pid = ps.output.split("\n").find((l) => /\blabapp\b.*lab-hog/.test(l))?.trim().split(/\s+/)[0];
        think(`A runaway process (${pid}) is spinning. Stopping it.`);
        if (pid) await tools.call("kill_process", { pid: Number(pid) });
        break;
      }
    }

    const after = await tools.call("check_health", {});
    if (after.output.startsWith("HEALTHY")) {
      await tools.call("resolve", { summary: `Scripted fix for ${scenarioId}; the site is healthy again.` });
    } else {
      think("Still unhealthy. Giving up.");
    }
    return { provider: "fake", model: "scripted", usage };
  };
}
