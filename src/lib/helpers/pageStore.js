import { page } from '$app/state';
import { toStore } from 'svelte/store';

/**
 * SvelteKit 3 removed `$app/stores`. Legacy `$:` statements only re-run when a
 * store changes, so this exposes the current page state as a store.
 * Call it during component init and keep reading `$page`.
 */
export function pageStore() {
	return toStore(() => ({
		url: page.url,
		params: page.params,
		route: page.route,
		status: page.status,
		error: page.error,
		data: page.data,
		form: page.form,
		state: page.state
	}));
}
