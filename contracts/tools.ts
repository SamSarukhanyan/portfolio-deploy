// The agent's allowlist. The model sees name/description/params; nothing else can run.
// runner "local": executed by the Control Plane itself. runner "ssm": the SSM document
// `lab-<name>` on the lab instance, whose parameters re-validate the same patterns.

export const OUTPUT_LIMIT = { chars: 2000, lines: 40 } as const; // longer output is cut, tail kept

type Param =
  | { type: "string"; enum: readonly string[] }
  | { type: "string"; pattern: string }
  | { type: "integer"; minimum: number; maximum: number };

export interface ToolSpec {
  name: string;
  kind: "read" | "action";
  runner: "local" | "ssm";
  description: string;                 // for the model, keep it short
  params: Record<string, Param>;       // all params are required
  explain: (args: Record<string, unknown>) => string; // for viewers, free of tokens
}

const SERVICE = { type: "string", enum: ["nginx", "app"] } as const;

export const TOOLS: readonly ToolSpec[] = [
  // read
  { name: "check_health", kind: "read", runner: "local", params: {},
    description: "HTTP GET the lab site: /, /api/health and the JS bundle that / references. Status code and latency of each.",
    explain: () => "Opening the website like a visitor would." },
  { name: "get_metrics", kind: "read", runner: "ssm", params: {},
    description: "CPU %, memory %, disk % and load average of the lab server.",
    explain: () => "Checking the server's vital signs." },
  { name: "service_status", kind: "read", runner: "ssm", params: { service: SERVICE },
    description: "systemd status of a service.",
    explain: (a) => `Is the ${a.service === "nginx" ? "web server" : "application"} running?` },
  { name: "read_logs", kind: "read", runner: "ssm",
    params: { service: SERVICE, lines: { type: "integer", minimum: 1, maximum: 100 } },
    description: "Last lines of a service's journal.",
    explain: (a) => `Reading the ${a.service === "nginx" ? "web server" : "application"}'s diary.` },
  { name: "disk_usage", kind: "read", runner: "ssm", params: {},
    description: "df for / and the 10 largest files under /var/lab.",
    explain: () => "Checking whether the disk is full." },
  { name: "list_processes", kind: "read", runner: "ssm", params: {},
    description: "Top 10 processes by CPU: pid, user, cpu%, mem%, command.",
    explain: () => "Looking for a program that eats all the power." },
  { name: "list_releases", kind: "read", runner: "ssm", params: {},
    description: "Deployed releases, newest first, and which one is current.",
    explain: () => "Looking at recent versions of the website." },
  { name: "nginx_config_test", kind: "read", runner: "ssm", params: {},
    description: "Run nginx -t and return its output.",
    explain: () => "Checking the web server's settings for mistakes." },
  { name: "recent_changes", kind: "read", runner: "ssm", params: {},
    description: "Last 10 changes on the server: deploys and config edits with timestamps.",
    explain: () => "Asking: what changed recently?" },

  // action
  { name: "restart_service", kind: "action", runner: "ssm", params: { service: SERVICE },
    description: "Restart a service.",
    explain: (a) => `Restarting the ${a.service === "nginx" ? "web server" : "application"}.` },
  { name: "rollback", kind: "action", runner: "ssm",
    params: { release: { type: "string", pattern: "^[0-9a-f]{7,40}$" } },
    description: "Switch current to an existing release.",
    explain: () => "Going back to the previous working version." },
  { name: "delete_file", kind: "action", runner: "ssm",
    params: { path: { type: "string", pattern: "^/var/lab(/[A-Za-z0-9_-][A-Za-z0-9._-]*)+$" } },
    description: "Delete one file under /var/lab.",
    explain: () => "Removing the junk file that filled the disk." },
  { name: "kill_process", kind: "action", runner: "ssm",
    params: { pid: { type: "integer", minimum: 2, maximum: 4194304 } },
    description: "Kill a process owned by user labapp (others are refused).",
    explain: () => "Stopping the runaway program." },
  { name: "restore_config", kind: "action", runner: "ssm",
    params: { name: { type: "string", enum: ["nginx"] } },
    description: "Restore the last known-good config and reload the service.",
    explain: () => "Putting back the last working settings." },
  { name: "resolve", kind: "action", runner: "local",
    params: { summary: { type: "string", pattern: "^[\\s\\S]{10,500}$" } },
    description: "Call when the site is verified healthy. Summary: root cause and fix in 1-3 sentences.",
    explain: () => "Declaring the incident fixed." },
];
