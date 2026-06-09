import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Consul from 'consul';

export interface BreedersAvailabilityEntry {
  hasAvailableAnimals: boolean;
  availableCount: number;
  availableBreeds: { value: string; count: number }[];
}

interface ConsulServiceEntry {
  Service: { Address: string; Port: number };
  Node: { Address: string };
}

/**
 * Internal-cluster HTTP client for organization-service.
 * Uses Consul service discovery (same source the Spring gateway's `lb://`
 * load balancer trusts) to find a healthy instance and calls the bulk
 * /organizations/breeders/availability endpoint. Resolved address is
 * cached for ADDRESS_TTL_MS to amortize Consul lookups on a hot path
 * (every /search?orgCategory=BREEDERS hit).
 */
@Injectable()
export class OrgServiceClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrgServiceClient.name);
  private readonly consul: Consul;
  private cachedAddress: { url: string; until: number } | null = null;

  // Service discovery is cheap but not free — cache for 30s, force refresh on call failure.
  private static readonly ADDRESS_TTL_MS = 30_000;
  private static readonly REQUEST_TIMEOUT_MS = 3_000;

  constructor() {
    const config: any = {
      host: process.env.CONSUL_HOST || 'localhost',
      secure: process.env.CONSUL_SECURE === 'true',
    };
    if (process.env.CONSUL_PORT) config.port = Number(process.env.CONSUL_PORT);
    if (process.env.CONSUL_TOKEN) {
      config.defaults = { token: process.env.CONSUL_TOKEN };
    }
    this.consul = new Consul(config);
  }

  onModuleInit() {
    // no-op; lazy connect
  }

  async onModuleDestroy() {
    // no-op
  }

  /**
   * Bulk availability lookup. Returns the raw map from the org-service
   * endpoint (orgs with zero matches are absent). Caller defaults missing
   * entries to zeroes. Returns {} on transport / discovery / parse errors —
   * NEVER throws to the caller, because enrichment failure should not break
   * /search.
   */
  async getBreedersAvailability(
    orgIds: string[],
  ): Promise<Record<string, BreedersAvailabilityEntry>> {
    if (orgIds.length === 0) return {};
    try {
      const url = await this.resolveServiceUrl();
      const qs = new URLSearchParams({ orgIds: orgIds.join(',') }).toString();
      const res = await this.fetchWithTimeout(
        `${url}/organizations/breeders/availability?${qs}`,
        OrgServiceClient.REQUEST_TIMEOUT_MS,
      );
      if (!res.ok) {
        this.logger.warn(
          `org-service availability returned ${res.status} for ${orgIds.length} ids`,
        );
        return {};
      }
      const body = (await res.json()) as {
        availability: Record<string, BreedersAvailabilityEntry>;
      };
      return body.availability ?? {};
    } catch (err: any) {
      this.logger.warn(
        `org-service availability call failed: ${err?.message ?? err}`,
      );
      // Bust the address cache so the next call re-resolves through Consul
      this.cachedAddress = null;
      return {};
    }
  }

  private async resolveServiceUrl(): Promise<string> {
    if (this.cachedAddress && this.cachedAddress.until > Date.now()) {
      return this.cachedAddress.url;
    }
    const entries = (await this.consul.health.service({
      service: 'organization-service',
      passing: true,
    } as any)) as ConsulServiceEntry[];
    if (!entries?.length) {
      throw new Error('No passing organization-service instances in Consul');
    }
    const pick = entries[Math.floor(Math.random() * entries.length)];
    const host = pick.Service.Address || pick.Node.Address;
    const port = pick.Service.Port;
    const url = `http://${host}:${port}`;
    this.cachedAddress = {
      url,
      until: Date.now() + OrgServiceClient.ADDRESS_TTL_MS,
    };
    return url;
  }

  private async fetchWithTimeout(
    url: string,
    timeoutMs: number,
  ): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}
