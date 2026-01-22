/**
 * Search Provider Interface
 * 
 * Abstract interface for search functionality to prevent vendor lock-in.
 * Implementations can be easily swapped (Algolia, Meilisearch, Typesense, etc.)
 * 
 * @typedef {Object} SearchOptions
 * @property {number} [hitsPerPage] - Number of results per page
 * @property {number} [page] - Page number
 * @property {Object.<string, any>} [filters] - Filtering options
 * 
 * @typedef {Object} SearchResult
 * @property {Array} hits - Search results
 * @property {number} nbHits - Total number of hits
 * @property {number} page - Current page
 * @property {number} nbPages - Total pages
 * @property {number} hitsPerPage - Hits per page
 * @property {number} processingTimeMS - Time taken to process
 * @property {string} query - Original query
 * @property {Object} params - Search parameters used
 */

/**
 * Base search provider interface
 */
export class SearchProvider {
	/**
	 * Initialize the search provider
	 * @param {Object} config - Provider configuration
	 */
	constructor(config) {
		if (this.constructor === SearchProvider) {
			throw new Error('SearchProvider is abstract and cannot be instantiated directly');
		}
		this.config = config;
	}

	/**
	 * Perform a search query
	 * @param {string} query - Search query
	 * @param {SearchOptions} options - Search options
	 * @returns {Promise<SearchResult>} Search results
	 */
	async search(query, options = {}) { // eslint-disable-line no-unused-vars
		throw new Error('search() must be implemented by subclass');
	}

	/**
	 * Perform a multi-index search
	 * @param {Array<{index: string, query: string, options?: SearchOptions}>} queries - Multiple queries
	 * @returns {Promise<Array<SearchResult>>} Array of search results
	 */
	async multiSearch(queries) { // eslint-disable-line no-unused-vars
		throw new Error('multiSearch() must be implemented by subclass');
	}

	/**
	 * Get search suggestions/autocomplete
	 * @param {string} query - Partial query
	 * @param {SearchOptions} options - Search options
	 * @returns {Promise<Array>} Suggestions
	 */
	async suggest(query, options = {}) { // eslint-disable-line no-unused-vars
		throw new Error('suggest() must be implemented by subclass');
	}

	/**
	 * Check if provider is ready
	 * @returns {boolean} True if ready
	 */
	isReady() {
		throw new Error('isReady() must be implemented by subclass');
	}

	/**
	 * Clean up resources
	 */
	destroy() {
		// Override in subclass if needed
	}
}
