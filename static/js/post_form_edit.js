import { setupArtistAutocomplete } from "./artist_autocomplete.js";
import { setupCategoryButtons } from "./category_buttons.js";
import { setupImageUploadCore } from "./image_upload_core.js";
import { setupMembersLoader } from "./members_loader.js";

document.addEventListener("DOMContentLoaded", () => {
  const ajaxBaseUrl = window.ajaxBaseUrl;
  const selectedMemberIds = window.selectedMemberIds || [];
  const existingImages = window.existingImages || [];

  setupArtistAutocomplete(ajaxBaseUrl);
  setupCategoryButtons();
  setupImageUploadCore({ formId: "edit-form", existingImages });
  setupMembersLoader(ajaxBaseUrl, selectedMemberIds);
});
