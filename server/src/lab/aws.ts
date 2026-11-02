// The only place that talks to AWS: wake/sleep the lab and run lab-* SSM documents on it.

import { DescribeInstancesCommand, EC2Client, StartInstancesCommand, StopInstancesCommand } from "@aws-sdk/client-ec2";
import {
  DescribeInstanceInformationCommand,
  GetCommandInvocationCommand,
  SendCommandCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { OUTPUT_LIMIT } from "../../../contracts/tools.js";
import { config } from "./config.js";

const ec2 = new EC2Client({ region: config.region });
const ssm = new SSMClient({ region: config.region });
const ids = [config.labInstanceId];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function labState(): Promise<string> {
  const out = await ec2.send(new DescribeInstancesCommand({ InstanceIds: ids }));
  return out.Reservations?.[0]?.Instances?.[0]?.State?.Name ?? "unknown";
}

async function ssmOnline(): Promise<boolean> {
  const out = await ssm.send(
    new DescribeInstanceInformationCommand({ Filters: [{ Key: "InstanceIds", Values: ids }] }),
  );
  return out.InstanceInformationList?.[0]?.PingStatus === "Online";
}

/** Starts the lab if needed and resolves once SSM can reach it. */
export async function wakeLab(): Promise<void> {
  const deadline = Date.now() + 5 * 60_000;
  for (;;) {
    const state = await labState();
    if (state === "stopped") await ec2.send(new StartInstancesCommand({ InstanceIds: ids }));
    if (state === "running" && (await ssmOnline())) return;
    if (Date.now() > deadline) throw new Error(`lab did not wake up (state ${state})`);
    await sleep(5000);
  }
}

export async function sleepLab(): Promise<void> {
  await ec2.send(new StopInstancesCommand({ InstanceIds: ids }));
}

/** Keeps the tail: the end of a log or command output is what matters. */
export function truncate(text: string): string {
  let lines = text.trimEnd().split("\n");
  if (lines.length > OUTPUT_LIMIT.lines) lines = ["…", ...lines.slice(-OUTPUT_LIMIT.lines)];
  const out = lines.join("\n");
  return out.length > OUTPUT_LIMIT.chars ? "…" + out.slice(-OUTPUT_LIMIT.chars) : out;
}

export interface DocResult {
  ok: boolean;
  output: string;
  durationMs: number;
}

/** Runs one lab-* document and waits for it. Callers decide which documents are allowed. */
export async function runDoc(name: string, params: Record<string, string> = {}, timeoutMs = 90_000): Promise<DocResult> {
  const started = Date.now();
  const sent = await ssm.send(
    new SendCommandCommand({
      InstanceIds: ids,
      DocumentName: name,
      Parameters: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, [v]])),
    }),
  );
  const CommandId = sent.Command?.CommandId;
  if (!CommandId) throw new Error(`SSM did not accept ${name}`);

  while (Date.now() - started < timeoutMs) {
    await sleep(800);
    try {
      const inv = await ssm.send(new GetCommandInvocationCommand({ CommandId, InstanceId: config.labInstanceId }));
      if (inv.Status && ["Pending", "InProgress", "Delayed"].includes(inv.Status)) continue;
      const output = [inv.StandardOutputContent, inv.StandardErrorContent].filter(Boolean).join("\n");
      return {
        ok: inv.Status === "Success",
        output: truncate(output.replace(/^failed to run commands: exit status \d+\s*$/m, "")),
        durationMs: Date.now() - started,
      };
    } catch (e) {
      if ((e as Error).name !== "InvocationDoesNotExist") throw e; // not registered yet
    }
  }
  return { ok: false, output: `${name} timed out`, durationMs: Date.now() - started };
}
