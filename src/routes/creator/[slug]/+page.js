import { error } from '@sveltejs/kit';
/** @type {import('./$types').PageLoad} */
import { getReactionsByCreatorName } from '$lib/helpers/firebase';

export async function load({ params }) {
    if (params.slug) {
        const creatorPureReactions = await getReactionsByCreatorName(params.slug);
        return {
            slug: params.slug,
            creatorPureReactions
        };
    }
	throw error(404, 'Not found');
}