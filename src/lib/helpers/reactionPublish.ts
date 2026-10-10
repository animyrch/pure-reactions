/**
 * A reaction can go live with a reaction video, or as a remix of the original.
 * Remix mode clears the reaction video on purpose, so that absence is not a blocker.
 */
export function canPublishReactionMedia(
  input: {
    remixMode?: unknown;
    isReactionMissing?: unknown;
    reactionVideoId?: unknown;
  } = {}
): boolean {
  if (input?.remixMode === true) return true;

  if (typeof input?.isReactionMissing === "boolean") {
    return !input.isReactionMissing;
  }

  const reactionVideoId =
    typeof input?.reactionVideoId === "string" ? input.reactionVideoId.trim() : "";
  return reactionVideoId.length > 0;
}
