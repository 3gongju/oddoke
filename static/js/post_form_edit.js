import { setupArtistAutocomplete } from "./artist_autocomplete.js";
import { setupCategoryButtons } from "./category_buttons.js";
import { setupImageUploadEdit } from "./image_upload_edit.js";
import { setupMembersLoader } from "./members_loader.js";

document.addEventListener("DOMContentLoaded", () => {
  const ajaxBaseUrl = window.ajaxBaseUrl;
  const selectedMemberIds = window.selectedMemberIds || [];
  const existingImages = window.existingImages || [];

  setupArtistAutocomplete(ajaxBaseUrl);
  setupCategoryButtons();
  setupImageUploadEdit(existingImages);
  setupMembersLoader(ajaxBaseUrl, selectedMemberIds);
});
