import algoliasearch from 'algoliasearch/lite';
import { SearchProvider } from './SearchProvider.js';

/**
 * Algolia Search Provider Implementation
 * 
 * Wraps Algolia-specific functionality behind the SearchProvider interface.
 * Keeps all Algolia coupling isolated for easy migration.
 */
export class AlgoliaSearchProvider extends SearchProvider {
	/**
	 * @param {Object} config
	 * @param {string} config.appId - Algolia application ID
	 * @param {string} config.searchKey - Algolia search-only API key
	 * @param {string} config.defaultIndex - Default index name
	 */
	constructor(config) {
		super(config);

		if (!config.appId || !config.searchKey) {
			throw new Error('AlgoliaSearchProvider requires appId and searchKey');
		}

		this.client = algoliasearch(config.appId, config.searchKey);
		this.defaultIndex = config.defaultIndex;
		this._ready = true;
	}

	/**
	 * Perform a search in the specified index
	 * @param {string} query - Search query
	 * @param {Object} options
	 * @param {string} [options.index] - Index to search (defaults to defaultIndex)
	 * @param {number} [options.hitsPerPage] - Number of results per page
	 * @param {number} [options.page] - Page number
	 * @param {Object} [options.filters] - Algolia filters
	 * @returns {Promise<SearchResult>}
	 */
	async search(query, options = {}) {
		const indexName = options.index || this.defaultIndex;
		if (!indexName) {
			throw new Error('No index specified and no default index set');
		}

		const index = this.client.initIndex(indexName);

		const searchParams = {
			query: query.trim(),
			...(options.hitsPerPage && { hitsPerPage: options.hitsPerPage }),
			...(options.page !== undefined && { page: options.page }),
			...(options.filters && { filters: options.filters })
		};

		try {
			const result = await index.search(searchParams.query, searchParams);
			
			// Normalize response to provider-agnostic format
			return {
				hits: result.hits || [],
				nbHits: result.nbHits || 0,
				page: result.page || 0,
				nbPages: result.nbPages || 0,
				hitsPerPage: result.hitsPerPage || 20,
				processingTimeMS: result.processingTimeMS || 0,
				query: result.query || query,
				params: result.params || {},
				// Keep Algolia-specific data in metadata for backward compatibility
				_meta: {
					provider: 'algolia',
					index: indexName,
					exhaustiveNbHits: result.exhaustiveNbHits,
					exhaustiveTypo: result.exhaustiveTypo
				}
			};
		} catch (error) {
			console.error('[AlgoliaSearchProvider] Search failed:', error);
			throw error;
		}
	}

	/**
	 * Perform multi-index search
	 * @param {Array<{index: string, query: string, options?: Object}>} queries
	 * @returns {Promise<Array<SearchResult>>}
	 */
	async multiSearch(queries) {
		if (!Array.isArray(queries) || queries.length === 0) {
			return [];
		}

		// Convert to Algolia multi-search format
		const algoliaQueries = queries.map((q) => ({
			indexName: q.index || this.defaultIndex,
			query: q.query?.trim() || '',
			params: {
				...(q.options?.hitsPerPage && { hitsPerPage: q.options.hitsPerPage }),
				...(q.options?.page !== undefined && { page: q.options.page }),
				...(q.options?.filters && { filters: q.options.filters })
			}
		}));

		try {
			const { results } = await this.client.search(algoliaQueries);
			
			// Normalize results
			return (results || []).map((result, idx) => ({
				hits: result.hits || [],
				nbHits: result.nbHits || 0,
				page: result.page || 0,
				nbPages: result.nbPages || 0,
				hitsPerPage: result.hitsPerPage || 20,
				processingTimeMS: result.processingTimeMS || 0,
				query: result.query || queries[idx]?.query || '',
				params: result.params || {},
				index: result.index || queries[idx]?.index,
				_meta: {
					provider: 'algolia',
					index: result.index
				}
			}));
		} catch (error) {
			console.error('[AlgoliaSearchProvider] Multi-search failed:', error);
			throw error;
		}
	}

	/**
	 * Get search suggestions (uses same API as search for Algolia)
	 * @param {string} query - Partial query
	 * @param {Object} options
	 * @returns {Promise<Array>}
	 */
	async suggest(query, options = {}) {
		const result = await this.search(query, {
			...options,
			hitsPerPage: options.hitsPerPage || 5
		});
		return result.hits;
	}

	/**
	 * Check if provider is ready
	 * @returns {boolean}
	 */
	isReady() {
		return this._ready && Boolean(this.client);
	}

	/**
	 * Clean up resources
	 */
	destroy() {
		this.client = null;
		this._ready = false;
	}
}
