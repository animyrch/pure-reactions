import { error } from '@sveltejs/kit';

export function load({ params }) {
    if (params.slug) {
        return { slug: params.slug };
    }
    throw error(404, 'Queue not found');
}
