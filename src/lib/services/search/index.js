import { env } from '$env/dynamic/public';
import { AlgoliaSearchProvider } from './AlgoliaSearchProvider.js';

/**
 * Search Service Factory
 * 
 * Creates and manages search provider instances.
 * Provides a single point of configuration for the entire app.
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
 * Get or create the search provider instance
 * Currently returns Algolia, but can be easily swapped
 * 
 * @returns {SearchProvider} Search provider instance
 */
export function getSearchProvider() {
	if (searchProviderInstance) {
		return searchProviderInstance;
	}

	// Default to Algolia for now
	// To switch providers, change this block
	const provider = 'algolia';

	switch (provider) {
		case 'algolia': {
			const config = SEARCH_CONFIG.algolia;
			
			if (!config.appId || !config.searchKey) {
				console.warn('[SearchService] Algolia credentials not configured');
				return null;
			}

			searchProviderInstance = new AlgoliaSearchProvider(config);
			break;
		}

		// Future providers can be added here:
		// case 'meilisearch':
		//   searchProviderInstance = new MeilisearchProvider(config);
		//   break;
		// case 'typesense':
		//   searchProviderInstance = new TypesenseProvider(config);
		//   break;

		default:
			throw new Error(`Unknown search provider: ${provider}`);
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
