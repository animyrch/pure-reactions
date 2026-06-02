import { error } from '@sveltejs/kit';
/** @type {import('./$types').PageLoad} */

export function load({ params, data }) {
    if (params.slug) {
        return {
            ...data,
            slug: params.slug
        };
    }
	error(404, 'Not found');
}
