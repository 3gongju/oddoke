import { setupArtistAutocomplete } from "./artist_autocomplete.js";
import { setupCategoryButtons } from "./category_buttons.js";
import { setupImageUpload } from "./image_upload.js";
import { setupMembersLoader } from "./members_loader.js";

document.addEventListener("DOMContentLoaded", () => {
  const ajaxBaseUrl = window.ajaxBaseUrl;
  const selectedMemberIds = window.selectedMemberIds || [];
  const existingImages = window.existingImages || [];

  setupArtistAutocomplete(ajaxBaseUrl);
  setupCategoryButtons();
  setupImageUpload({ formId: "edit-form", existingImages });
  setupMembersLoader(ajaxBaseUrl, selectedMemberIds);
});
