import { error } from '@sveltejs/kit';
/** @type {import('./$types').PageLoad} */
import { getReactionsByReactorName } from '$lib/helpers/firebase';

export async function load({ params }) {
    if (params.slug) {
        const creatorPureReactions = await getReactionsByReactorName(params.slug);
        return {
            slug: params.slug,
            creatorPureReactions
        };
    }
	throw error(404, 'Not found');
}