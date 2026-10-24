import {
  ShareNodesSolid,
  BookmarkSolid,
  HomeSolid,
  UserCircleSolid,
  BellActiveAltSolid,
  PenSolid,
  CheckCircleSolid,
  ArrowUpFromBracketOutline,
  EyeSlashSolid,
  ListMusicSolid,
} from "flowbite-svelte-icons";
import { canPublishReactionMedia } from "$lib/helpers/reactionPublish";

/**
 * Contextual reaction actions that used to live on the speed dial.
 * @param {object} state
 */
export function buildReactionMenuOptions(state) {
  const itemList = [];
  const {
    isUsersOwnVideo,
    canShowEditModeButton,
    canShowCloseEditModeButton,
    isPublished,
    isReactionMissing,
    remixMode,
    canShowEditPlaylistButton,
    handlers = {},
  } = state ?? {};

  if (isUsersOwnVideo && canShowEditModeButton && handlers.enterEditMode) {
    itemList.push({
      name: "Edit Reaction",
      icon: PenSolid,
      onSelect: handlers.enterEditMode,
    });
  }

  if (canShowEditPlaylistButton && handlers.editPlaylist) {
    itemList.push({
      name: "Edit Playlist",
      icon: ListMusicSolid,
      onSelect: handlers.editPlaylist,
    });
  }

  if (isUsersOwnVideo && canShowCloseEditModeButton && handlers.closeEditMode) {
    itemList.push({
      name: "Finish Editing",
      icon: CheckCircleSolid,
      onSelect: handlers.closeEditMode,
    });
  }

  if (
    isUsersOwnVideo &&
    !isPublished &&
    canPublishReactionMedia({ isReactionMissing, remixMode }) &&
    handlers.setIsPublished
  ) {
    itemList.push({
      name: "Publish Reaction",
      icon: ArrowUpFromBracketOutline,
      onSelect: handlers.setIsPublished,
    });
  }

  if (isUsersOwnVideo && isPublished && handlers.setIsUnpublished) {
    itemList.push({
      name: "Unpublish Reaction",
      icon: EyeSlashSolid,
      onSelect: handlers.setIsUnpublished,
    });
  }

  return itemList;
}

export function buildBaseMenuOptions({ onShare }) {
  return [
    { name: "Home", icon: HomeSolid, href: "/" },
    { name: "My Account", icon: UserCircleSolid, href: "/account" },
    { name: "My Bookmarks", icon: BookmarkSolid, href: "/bookmark" },
    {
      name: "Reactors I Follow",
      icon: BellActiveAltSolid,
      href: "/?sortBy=following",
    },
    { name: "Share Current Page", icon: ShareNodesSolid, onSelect: onShare },
  ];
}
