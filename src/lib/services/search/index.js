import { env } from '$env/dynamic/public';
import { AlgoliaSearchProvider } from './AlgoliaSearchProvider.js';
import { LocalSearchProvider } from './LocalSearchProvider.js';
import { LOCAL_SEARCH_FIXTURES } from './local-search-fixtures.js';

/**
 * Search Service Factory
 *
 * Creates and manages search provider instances.
 * When Algolia credentials are present, Algolia is used.
 * When credentials are absent (local / contributor mode), the LocalSearchProvider
 * is used automatically — no external setup required.
 */

let searchProviderInstance = null;

/**
 * Configuration for search providers
 */
const SEARCH_CONFIG = {
	// Minimum query length to trigger search
	minQueryLength: 2,
	
	// Debounce delay for search input (ms)
	debounceDelay: 300,
	
	// Default results per page
	defaultHitsPerPage: 20,
	
	// Provider-specific config
	algolia: {
		appId: env.PUBLIC_ALGOLIA_APP_ID,
		searchKey: env.PUBLIC_ALGOLIA_SEARCH_API_KEY,
		defaultIndex: env.PUBLIC_ALGOLIA_REACTIONS_INDEX
	}
};

/**
 * Get or create the search provider instance.
 *
 * Selection priority:
 *  1. Algolia — when PUBLIC_ALGOLIA_APP_ID and PUBLIC_ALGOLIA_SEARCH_API_KEY are set.
 *  2. Local   — automatic fallback for local / contributor mode (no credentials needed).
 *
 * @returns {SearchProvider} Search provider instance
 */
export function getSearchProvider() {
	if (searchProviderInstance) {
		return searchProviderInstance;
	}

	const algoliaConfig = SEARCH_CONFIG.algolia;
	const hasAlgolia = Boolean(algoliaConfig.appId && algoliaConfig.searchKey);

	if (hasAlgolia) {
		searchProviderInstance = new AlgoliaSearchProvider(algoliaConfig);
	} else {
		// Local / contributor mode: no remote credentials required.
		console.info('[SearchService] Algolia credentials not configured — using local search provider (contributor mode).');
		searchProviderInstance = new LocalSearchProvider({ data: LOCAL_SEARCH_FIXTURES });
	}

	return searchProviderInstance;
}

/**
 * Get search configuration
 * @returns {Object} Search configuration
 */
export function getSearchConfig() {
	return { ...SEARCH_CONFIG };
}

/**
 * Destroy the current search provider instance
 * Useful for testing or hot-reload scenarios
 */
export function destroySearchProvider() {
	if (searchProviderInstance) {
		searchProviderInstance.destroy();
		searchProviderInstance = null;
	}
}

/**
 * Check if query meets minimum length requirement
 * @param {string} query - Query string
 * @returns {boolean} True if query is valid
 */
export function isValidQuery(query) {
	const trimmed = query?.trim() || '';
	return trimmed.length >= SEARCH_CONFIG.minQueryLength;
}

/**
 * Normalize query (trim, lowercase, etc.)
 * @param {string} query - Raw query
 * @returns {string} Normalized query
 */
export function normalizeQuery(query) {
	return (query || '').trim();
}
