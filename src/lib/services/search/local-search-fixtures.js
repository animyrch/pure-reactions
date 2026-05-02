/**
 * Local search fixtures
 *
 * These records mirror the shape of Algolia index records (objectID + flat
 * reaction fields) and correspond to the docs seeded by local-dev-seed.json.
 * They allow the LocalSearchProvider to serve results on a fresh clone
 * without any remote credentials.
 *
 * Keep this list in sync with tests/fixtures/reactions/local-dev-seed.json.
 */

/** @type {Array<Object>} */
export const LOCAL_SEARCH_FIXTURES = [
	{
		objectID: 'local-sample-001',
		reactionVideoId: '8-3PahRtgF4',
		originalVideoId: '8-3PahRtgF4',
		reactionVideoTitle: 'Reacting to The original Dragon Ball was UNHINGED 💀',
		originalVideoTitle: 'The original Dragon Ball was UNHINGED 💀 | Mercenary Tao HUNTS down Goku',
		reactionVideoAuthor: '@localreactor',
		originalVideoAuthor: '@the_animaniace',
		reactorDisplayName: 'Local Reactor',
		playlistId: '',
		isPublished: true,
		createdAt: 1735725600000,
		updatedAt: 1735725600000,
	},
	{
		objectID: 'local-sample-002',
		reactionVideoId: 'qg6b4b0FAB4',
		originalVideoId: 'qg6b4b0FAB4',
		reactionVideoTitle: 'Reacting to Sample Original Video B',
		originalVideoTitle: 'Sample Original Video B — Play Trigger Demo',
		reactionVideoAuthor: '@devreactor',
		originalVideoAuthor: '@testCreatorB',
		reactorDisplayName: 'Dev Reactor',
		playlistId: '',
		isPublished: true,
		createdAt: 1735812000000,
		updatedAt: 1735812000000,
	},
	{
		objectID: 'local-sample-003',
		reactionVideoId: 'dHh_gt4sBbw',
		originalVideoId: 'dHh_gt4sBbw',
		reactionVideoTitle: 'Reacting to Sample Original Video C',
		originalVideoTitle: 'Sample Original Video C — Volume Stability Demo',
		reactionVideoAuthor: '@volumereactor',
		originalVideoAuthor: '@testCreatorC',
		reactorDisplayName: 'Volume Reactor',
		playlistId: '',
		isPublished: true,
		createdAt: 1735898400000,
		updatedAt: 1735898400000,
	},
	{
		objectID: 'local-sample-004',
		reactionVideoId: 'GQ_SlNONhx4',
		originalVideoId: 'GQ_SlNONhx4',
		reactionVideoTitle: 'Reacting to Sample Original Video D',
		originalVideoTitle: 'Sample Original Video D — Resume After Pause Demo',
		reactionVideoAuthor: '@pausereactor',
		originalVideoAuthor: '@testCreatorD',
		reactorDisplayName: 'Pause Reactor',
		playlistId: '',
		isPublished: true,
		createdAt: 1735984800000,
		updatedAt: 1735984800000,
	},
	{
		objectID: 'local-sample-005',
		reactionVideoId: '8-3PahRtgF4',
		originalVideoId: '8-3PahRtgF4',
		reactionVideoTitle: 'Open Source Fan Reacts to Dragon Ball Showcase',
		originalVideoTitle: 'Open Source Demo: Dragon Ball Reaction Showcase',
		reactionVideoAuthor: '@opensourcefan',
		originalVideoAuthor: '@openSourceCreator',
		reactorDisplayName: 'Open Source Fan',
		playlistId: '',
		isPublished: true,
		createdAt: 1736071200000,
		updatedAt: 1736071200000,
	},
	// Published layout fixtures (from tests/fixtures/reactions/reaction-layout.json)
	{
		objectID: 'layout-unverified',
		reactionVideoId: '8-3PahRtgF4',
		originalVideoId: '8-3PahRtgF4',
		reactionVideoTitle: 'The original Dragon Ball was UNHINGED | Mercenary Tao HUNTS down the Goku',
		originalVideoTitle: 'The original Dragon Ball was UNHINGED | Mercenary Tao HUNTS down the Goku',
		reactionVideoAuthor: '@unverifiedchannel',
		originalVideoAuthor: '@the_animaniace',
		reactorDisplayName: 'Unverified User',
		playlistId: '',
		isPublished: true,
		createdAt: 1736157600000,
		updatedAt: 1736157600000,
	},
	{
		objectID: 'layout-verified-owner',
		reactionVideoId: '8-3PahRtgF4',
		originalVideoId: '8-3PahRtgF4',
		reactionVideoTitle: 'The original Dragon Ball was UNHINGED | Mercenary Tao HUNTS down the Goku',
		originalVideoTitle: 'The original Dragon Ball was UNHINGED | Mercenary Tao HUNTS down the Goku',
		reactionVideoAuthor: '@verifiedowner',
		originalVideoAuthor: '@the_animaniace',
		reactorDisplayName: 'Verified Owner',
		playlistId: '',
		isPublished: true,
		createdAt: 1736244000000,
		updatedAt: 1736244000000,
	},
];
