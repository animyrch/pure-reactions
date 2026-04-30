import { SearchProvider } from './SearchProvider.js';

/**
 * Local Search Provider
 *
 * Searches an in-memory corpus of reaction records.
 * Requires no external credentials and is automatically selected when
 * Algolia credentials are absent (local / contributor mode).
 *
 * Records in the corpus must include an `objectID` field plus any
 * searchable reaction fields (reactionVideoTitle, originalVideoTitle, etc.).
 */
export class LocalSearchProvider extends SearchProvider {
	/**
	 * @param {Object} config
	 * @param {Array<Object>} config.data - Array of reaction records to search
	 */
	constructor(config) {
		super(config);
		this._data = Array.isArray(config.data) ? config.data : [];
		this._ready = true;
	}

	/**
	 * Perform a simple substring search across the corpus.
	 *
	 * @param {string} query
	 * @param {Object} options
	 * @param {number} [options.hitsPerPage]
	 * @param {number} [options.page]
	 * @returns {Promise<import('./SearchProvider.js').SearchResult>}
	 */
	async search(query, options = {}) {
		const hitsPerPage = options.hitsPerPage || 20;
		const page = options.page || 0;
		const normalized = (query || '').trim().toLowerCase();

		const matched = normalized.length === 0
			? this._data.slice()
			: this._data.filter((record) => this._matches(record, normalized));

		const nbHits = matched.length;
		const nbPages = Math.ceil(nbHits / hitsPerPage) || 1;
		const start = page * hitsPerPage;
		const hits = matched.slice(start, start + hitsPerPage);

		return {
			hits,
			nbHits,
			page,
			nbPages,
			hitsPerPage,
			processingTimeMS: 0,
			query,
			params: {},
			_meta: { provider: 'local' }
		};
	}

	/**
	 * Multi-search: runs each query independently.
	 *
	 * @param {Array<{query: string, options?: Object}>} queries
	 * @returns {Promise<Array<import('./SearchProvider.js').SearchResult>>}
	 */
	async multiSearch(queries) {
		if (!Array.isArray(queries) || queries.length === 0) {
			return [];
		}
		return Promise.all(queries.map((q) => this.search(q.query, q.options || {})));
	}

	/**
	 * Suggest: returns up to 5 matching hits.
	 *
	 * @param {string} query
	 * @param {Object} options
	 * @returns {Promise<Array>}
	 */
	async suggest(query, options = {}) {
		const result = await this.search(query, { ...options, hitsPerPage: options.hitsPerPage || 5 });
		return result.hits;
	}

	/** @returns {boolean} */
	isReady() {
		return this._ready;
	}

	destroy() {
		this._data = [];
		this._ready = false;
	}

	// ─── private helpers ──────────────────────────────────────────────────────

	/**
	 * Returns true if any searchable field in the record contains the query.
	 * @param {Object} record
	 * @param {string} query - already lower-cased
	 */
	_matches(record, query) {
		const fields = [
			record.reactionVideoTitle,
			record.originalVideoTitle,
			record.reactionVideoAuthor,
			record.originalVideoAuthor,
			record.reactorDisplayName,
		];
		return fields.some((f) => typeof f === 'string' && f.toLowerCase().includes(query));
	}
}
