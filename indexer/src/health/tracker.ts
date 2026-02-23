export type Status = "healthy" | "unhealthy" | "starting";

export interface ComponentHealth {
  status: Status;
  lastUpdate: number;
  detail?: string;
}

export class HealthTracker {
  private components = new Map<string, ComponentHealth>();

  update(name: string, status: Status, detail?: string): void {
    this.components.set(name, {
      status,
      lastUpdate: Date.now(),
      detail,
    });
  }

  isHealthy(): boolean {
    if (this.components.size === 0) return false;
    for (const c of this.components.values()) {
      if (c.status !== "healthy") return false;
    }
    return true;
  }

  toJSON(): Record<string, ComponentHealth> {
    return Object.fromEntries(this.components);
  }
}
