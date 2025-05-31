import { setupArtistAutocomplete } from "./artist_autocomplete.js";
import { setupCategoryButtons } from "./category_buttons.js";
import { setupImageUploadCore } from "./image_upload_core.js";
import { setupMembersLoader } from "./members_loader.js";

document.addEventListener("DOMContentLoaded", () => {
  const ajaxBaseUrl = window.ajaxBaseUrl;
  const selectedMemberIds = window.selectedMemberIds || [];

  setupArtistAutocomplete(ajaxBaseUrl);
  setupCategoryButtons();
  setupImageUploadCore({ formId: "create-form" });
  setupMembersLoader(ajaxBaseUrl, selectedMemberIds);
});
