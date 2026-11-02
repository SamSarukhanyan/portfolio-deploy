// Control Plane settings, all from the environment (see server/lab.env.example).

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const config = {
  port: Number(process.env.LAB_PORT ?? "3100"),
  region: process.env.AWS_REGION ?? "eu-central-1",
  labInstanceId: required("LAB_INSTANCE_ID"),
  // Production: the lab's private address. Development: the public proxy.
  labUrl: (process.env.LAB_URL ?? "https://lab.samsarukhanyan.com").replace(/\/$/, ""),
  dataDir: process.env.LAB_DATA_DIR ?? "./lab-data",
  agent: process.env.AGENT ?? "fake",
  idleSleepMs: 15 * 60_000,
  slowHealthMs: Number(process.env.LAB_SLOW_HEALTH_MS ?? "1200"),
};
