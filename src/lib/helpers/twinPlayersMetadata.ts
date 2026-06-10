import { env } from '$env/dynamic/public';
import { updateFirebaseDocument } from '$lib/helpers/firebase';
import {
  fetchOriginalVideoMetadata,
  originalVideoMetadataToFirestoreFields,
  generateOriginalVideoSlug,
} from '$lib/helpers/originalVideo';
import { downloadBasicVideoDetails } from '$lib/helpers/youtube';

const DISABLE_YOUTUBE_METADATA_SYNC = env.PUBLIC_DISABLE_YOUTUBE_METADATA_SYNC === 'true';

type ReactionMetadataField =
  | 'originalVideoTitle'
  | 'reactionVideoTitle'
  | 'originalVideoAuthor'
  | 'reactionVideoAuthor';

type OriginalMetadataField =
  | 'originalVideoTitle'
  | 'originalVideoAuthor'
  | 'originalVideoAuthorUrl'
  | 'originalVideoDescription';

type TwinPlayersMetadataField =
  | OriginalMetadataField
  | 'reactionVideoTitle'
  | 'reactionVideoAuthor';

type VerifyVideoDetailsOptions = {
  videoId?: string;
  currentTitle?: string | null;
  currentAuthor?: string | null;
  titleField: 'originalVideoTitle' | 'reactionVideoTitle';
  authorField: 'originalVideoAuthor' | 'reactionVideoAuthor';
};

type VerifyVideoDetailsResult = {
  updates: Partial<Record<ReactionMetadataField, string>>;
  title?: string;
  author?: string;
};

type OriginalVideoMetadataSnapshot = {
  title?: string;
  author?: string;
  authorUrl?: string;
  description?: string;
};

type VerifyOriginalVideoDetailsResult = {
  metadata?: OriginalVideoMetadataSnapshot;
  updates: Partial<Record<OriginalMetadataField, string | number>>;
};

export type VerifyAndSyncTwinPlayersMetadataParams = {
  documentId?: string;
  fallbackDocumentId?: string;
  originalVideoId?: string;
  originalVideoPlatform?: 'youtube' | 'tiktok';
  originalVideoUrl?: string | null;
  reactionVideoId?: string;
  currentOriginalTitle?: string | null;
  currentOriginalAuthor?: string | null;
  currentOriginalAuthorUrl?: string | null;
  currentOriginalDescription?: string | null;
  currentReactionTitle?: string | null;
  currentReactionAuthor?: string | null;
};

export type TwinPlayersMetadataStatePatch = Partial<Record<TwinPlayersMetadataField, string>>;

export type VerifyAndSyncTwinPlayersMetadataResult = {
  resolvedDocumentId?: string;
  statePatch: TwinPlayersMetadataStatePatch;
};

const trimString = (value: string | null | undefined) =>
  typeof value === 'string' ? value.trim() : undefined;

const hasKeys = (value: object) => Object.keys(value).length > 0;

const verifyOriginalVideoDetails = async ({
  platform,
  videoId,
  videoUrl,
  currentTitle,
  currentAuthor,
  currentAuthorUrl,
  currentDescription
}: {
  platform?: 'youtube' | 'tiktok';
  videoId?: string;
  videoUrl?: string | null;
  currentTitle?: string | null;
  currentAuthor?: string | null;
  currentAuthorUrl?: string | null;
  currentDescription?: string | null;
}): Promise<VerifyOriginalVideoDetailsResult> => {
  const result: VerifyOriginalVideoDetailsResult = {
    updates: {}
  };

  if (!videoId) {
    return result;
  }

  try {
    const metadata = await fetchOriginalVideoMetadata({
      platform,
      videoId,
      videoUrl: videoUrl || undefined
    });
    const normalizedFields = originalVideoMetadataToFirestoreFields(metadata);
    const currentComparison = {
      originalVideoTitle: trimString(currentTitle),
      originalVideoAuthor: trimString(currentAuthor),
      originalVideoAuthorUrl: trimString(currentAuthorUrl),
      originalVideoDescription: trimString(currentDescription)
    };

    for (const [key, value] of Object.entries(normalizedFields)) {
      if (typeof value !== 'string' && typeof value !== 'number') {
        continue;
      }

      const nextValue = typeof value === 'string' ? value.trim() : value;
      const currentValue = currentComparison[key as keyof typeof currentComparison];
      if (nextValue && nextValue !== currentValue) {
        result.updates[key as OriginalMetadataField] = value;
      }
    }

    result.metadata = metadata;
  } catch (error) {
    console.error(`Failed to verify original metadata for video ${videoId}`, error);
  }

  return result;
};

const verifyVideoDetails = async ({
  videoId,
  currentTitle,
  currentAuthor,
  titleField,
  authorField
}: VerifyVideoDetailsOptions): Promise<VerifyVideoDetailsResult> => {
  const result: VerifyVideoDetailsResult = {
    updates: {},
    title: typeof currentTitle === 'string' ? currentTitle : undefined,
    author: typeof currentAuthor === 'string' ? currentAuthor : undefined
  };

  if (!videoId) {
    return result;
  }

  try {
    const { videoAuthor, videoTitle } = await downloadBasicVideoDetails(videoId);
    const sanitizedTitle = trimString(videoTitle);
    const sanitizedAuthor = trimString(videoAuthor);
    const storedTitle = trimString(currentTitle);
    const storedAuthor = trimString(currentAuthor);

    if (sanitizedTitle) {
      result.title = sanitizedTitle;
      if (sanitizedTitle !== storedTitle) {
        result.updates[titleField] = sanitizedTitle;
      }
    }

    if (sanitizedAuthor) {
      result.author = sanitizedAuthor;
      if (sanitizedAuthor !== storedAuthor) {
        result.updates[authorField] = sanitizedAuthor;
      }
    }
  } catch (error) {
    console.error(`Failed to verify metadata for video ${videoId}`, error);
  }

  return result;
};

export async function verifyAndSyncTwinPlayersMetadata({
  documentId,
  fallbackDocumentId,
  originalVideoId,
  originalVideoPlatform,
  originalVideoUrl,
  reactionVideoId,
  currentOriginalTitle,
  currentOriginalAuthor,
  currentOriginalAuthorUrl,
  currentOriginalDescription,
  currentReactionTitle,
  currentReactionAuthor
}: VerifyAndSyncTwinPlayersMetadataParams): Promise<VerifyAndSyncTwinPlayersMetadataResult> {
  const resolvedDocumentId = documentId ?? fallbackDocumentId;
  if (DISABLE_YOUTUBE_METADATA_SYNC || !resolvedDocumentId) {
    return {
      resolvedDocumentId,
      statePatch: {}
    };
  }

  const [originalVerification, reactionVerification] = await Promise.all([
    verifyOriginalVideoDetails({
      platform: originalVideoPlatform,
      videoId: originalVideoId,
      videoUrl: originalVideoUrl,
      currentTitle: currentOriginalTitle,
      currentAuthor: currentOriginalAuthor,
      currentAuthorUrl: currentOriginalAuthorUrl,
      currentDescription: currentOriginalDescription
    }),
    verifyVideoDetails({
      videoId: reactionVideoId,
      currentTitle: currentReactionTitle,
      currentAuthor: currentReactionAuthor,
      titleField: 'reactionVideoTitle',
      authorField: 'reactionVideoAuthor'
    })
  ]);

  const metadataUpdates: Record<string, string | number> = {
    ...originalVerification.updates,
    ...reactionVerification.updates
  };

  // If the original video title or author changed, regenerate the slug
  const hasOriginalTitleOrAuthorChange =
    'originalVideoTitle' in originalVerification.updates ||
    'originalVideoAuthor' in originalVerification.updates;

  if (hasOriginalTitleOrAuthorChange) {
    const updatedTitle = trimString(originalVerification.updates.originalVideoTitle) || trimString(currentOriginalTitle);
    const updatedAuthor = trimString(originalVerification.updates.originalVideoAuthor) || trimString(currentOriginalAuthor);
    if (updatedTitle || updatedAuthor) {
      const newSlug = generateOriginalVideoSlug(updatedTitle, updatedAuthor);
      metadataUpdates.originalVideoSlug = newSlug;
    }
  }

  if (hasKeys(metadataUpdates)) {
    try {
      await updateFirebaseDocument(metadataUpdates, resolvedDocumentId);
    } catch (error) {
      console.error('Failed to update reaction metadata in Firestore', error);
    }
  }

  const statePatch: TwinPlayersMetadataStatePatch = {};

  const normalizedOriginalTitle = trimString(currentOriginalTitle);
  const normalizedOriginalAuthor = trimString(currentOriginalAuthor);
  const normalizedOriginalAuthorUrl = trimString(currentOriginalAuthorUrl);
  const normalizedOriginalDescription = trimString(currentOriginalDescription);
  const normalizedReactionTitle = trimString(currentReactionTitle);
  const normalizedReactionAuthor = trimString(currentReactionAuthor);

  const nextOriginalTitle = trimString(originalVerification.metadata?.title);
  if (nextOriginalTitle && nextOriginalTitle !== normalizedOriginalTitle) {
    statePatch.originalVideoTitle = nextOriginalTitle;
  }

  const nextOriginalAuthor = trimString(originalVerification.metadata?.author);
  if (nextOriginalAuthor && nextOriginalAuthor !== normalizedOriginalAuthor) {
    statePatch.originalVideoAuthor = nextOriginalAuthor;
  }

  const nextOriginalAuthorUrl = trimString(originalVerification.metadata?.authorUrl);
  if (nextOriginalAuthorUrl && nextOriginalAuthorUrl !== normalizedOriginalAuthorUrl) {
    statePatch.originalVideoAuthorUrl = nextOriginalAuthorUrl;
  }

  const nextOriginalDescription = trimString(originalVerification.metadata?.description);
  if (nextOriginalDescription && nextOriginalDescription !== normalizedOriginalDescription) {
    statePatch.originalVideoDescription = nextOriginalDescription;
  }

  const nextReactionTitle = trimString(reactionVerification.title);
  if (nextReactionTitle && nextReactionTitle !== normalizedReactionTitle) {
    statePatch.reactionVideoTitle = nextReactionTitle;
  }

  const nextReactionAuthor = trimString(reactionVerification.author);
  if (nextReactionAuthor && nextReactionAuthor !== normalizedReactionAuthor) {
    statePatch.reactionVideoAuthor = nextReactionAuthor;
  }

  return {
    resolvedDocumentId,
    statePatch
  };
}