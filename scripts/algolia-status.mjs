#!/usr/bin/env node

/**
 * Algolia Status Check Script
 * 
 * Verifies Algolia account, indices, and configuration.
 * Reports on index health, record counts, and settings.
 * 
 * Usage:
 *   node scripts/algolia-status.mjs
 *   ALGOLIA_ADMIN_KEY=xxx node scripts/algolia-status.mjs
 */

import algoliasearch from 'algoliasearch';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function loadDotEnvIfPresent(envPath = '.env') {
  const abs = path.resolve(process.cwd(), envPath);
  if (!fs.existsSync(abs)) return;

  const raw = fs.readFileSync(abs, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function checkAlgoliaStatus() {
  loadDotEnvIfPresent('.env');

  const appId = process.env.PUBLIC_ALGOLIA_APP_ID;
  const adminKey = process.env.ALGOLIA_ADMIN_KEY;
  const indexName = process.env.PUBLIC_ALGOLIA_REACTIONS_INDEX;

  if (!appId) {
    throw new Error('Missing PUBLIC_ALGOLIA_APP_ID in environment');
  }

  if (!adminKey) {
    throw new Error('Missing ALGOLIA_ADMIN_KEY in environment. This is required for admin operations.');
  }

  if (!indexName) {
    console.warn('Warning: PUBLIC_ALGOLIA_REACTIONS_INDEX not set, will check all indices');
  }

  console.log('\n=== Algolia Status Check ===\n');
  console.log(`App ID: ${appId}`);
  console.log(`Target Index: ${indexName || '(all)'}\n`);

  const client = algoliasearch(appId, adminKey);

  // List all indices
  console.log('--- Available Indices ---');
  try {
    const { items: indices } = await client.listIndices();
    
    if (!indices || indices.length === 0) {
      console.log('⚠️  No indices found in this Algolia app');
      return;
    }

    console.log(`Found ${indices.length} indices:\n`);

    for (const idx of indices) {
      const isTarget = idx.name === indexName;
      const marker = isTarget ? '→' : ' ';
      console.log(`${marker} ${idx.name}`);
      console.log(`   Records: ${idx.entries?.toLocaleString() || 0}`);
      console.log(`   Created: ${idx.createdAt || 'unknown'}`);
      console.log(`   Updated: ${idx.updatedAt || 'unknown'}`);
      console.log('');
    }

    // Get detailed settings for target index
    if (indexName) {
      console.log('\n--- Target Index Settings ---');
      try {
        const index = client.initIndex(indexName);
        const settings = await index.getSettings();
        
        console.log('Searchable Attributes:', settings.searchableAttributes || ['(default: all)']);
        console.log('Attributes to Retrieve:', settings.attributesToRetrieve || ['(default: all)']);
        console.log('Attributes for Faceting:', settings.attributesForFaceting || ['(none)']);
        console.log('Ranking:', settings.ranking || ['(default)']);
        console.log('Custom Ranking:', settings.customRanking || ['(none)']);
        
        // Get a sample record
        console.log('\n--- Sample Record ---');
        const { hits } = await index.search('', { hitsPerPage: 1 });
        if (hits.length > 0) {
          const sample = hits[0];
          console.log('Object ID:', sample.objectID);
          console.log('Fields:', Object.keys(sample).filter(k => !k.startsWith('_')).join(', '));
          console.log('\nSample structure:');
          console.log(JSON.stringify(sample, null, 2).split('\n').slice(0, 20).join('\n') + '\n...');
        } else {
          console.log('⚠️  Index is empty - no records found');
        }
      } catch (err) {
        console.error(`❌ Error checking index "${indexName}":`, err.message);
        if (err.status === 404) {
          console.log(`\n⚠️  Index "${indexName}" does not exist yet. It will be created on first indexing.`);
        }
      }
    }

    console.log('\n=== Status Check Complete ===\n');

  } catch (error) {
    console.error('❌ Failed to list indices:', error.message);
    if (error.status === 403) {
      console.log('\n⚠️  Permission denied. Check that your ALGOLIA_ADMIN_KEY is correct and has admin permissions.');
    }
    throw error;
  }
}

checkAlgoliaStatus().catch((error) => {
  console.error('[algolia-status] failed', error);
  process.exitCode = 1;
});
