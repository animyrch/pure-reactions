export function buildMomentReactionEditHref(reactionSlug, momentId) {
  const slug = typeof reactionSlug === 'string' ? reactionSlug.trim() : '';
  if (!slug) return '';

  const id = typeof momentId === 'string' ? momentId.trim() : '';
  const query = new URLSearchParams();
  if (id) query.set('momentId', id);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return `/edit-reaction/${slug}${suffix}`;
}

export function syncMomentReactionDial(reactionDial, {
  isReady = false,
  isUsersOwnVideo = false,
  canShowEditModeButton = false,
  canShowCloseEditModeButton = false,
  isPublished = false,
  isReactionMissing = false,
  remixMode = false,
  isFullscreen = false,
  handlers = {}
} = {}) {
  if (!isReady) return false;

  reactionDial.updateContext({
    isUsersOwnVideo,
    canShowEditModeButton,
    canShowCloseEditModeButton,
    isPublished,
    isReactionMissing,
    remixMode,
    isFullscreen,
    canShowEditPlaylistButton: false,
    handlers: {
      enterEditMode: null,
      closeEditMode: null,
      setIsPublished: null,
      setIsUnpublished: null,
      openWithFullscreen: null,
      openWithHalfscreen: null,
      ...handlers
    }
  });

  return true;
}
