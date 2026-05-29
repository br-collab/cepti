/**
 * lib/sma/coordinator/registry.ts
 *
 * Platform agent dispatch registry. Maps Platform → AgentRole and
 * provides a factory for instantiating the right agent class.
 *
 * Adapted from Aureon's RANGER_AGENTS / JTAC_AGENTS pattern, simplified
 * to one platform-agent dimension (no tier hierarchy).
 */

import type { AgentRole, Platform } from './types';
import { PlatformAgent } from '../agents/platform-base';
import { FacebookAgent } from '../agents/facebook-agent';
import { InstagramAgent } from '../agents/instagram-agent';
import { ThreadsAgent } from '../agents/threads-agent';

export const PLATFORM_AGENTS: Record<Platform, new () => PlatformAgent> = {
  facebook: FacebookAgent,
  instagram: InstagramAgent,
  threads: ThreadsAgent,
};

export const ROLE_TO_PLATFORM: Partial<Record<AgentRole, Platform>> = {
  FACEBOOK_AGENT: 'facebook',
  INSTAGRAM_AGENT: 'instagram',
  THREADS_AGENT: 'threads',
};

/**
 * Instantiate the platform agent for the given platform.
 */
export function getPlatformAgent(platform: Platform): PlatformAgent {
  const AgentClass = PLATFORM_AGENTS[platform];
  if (!AgentClass) {
    throw new Error(`No platform agent registered for platform: ${platform}`);
  }
  return new AgentClass();
}
