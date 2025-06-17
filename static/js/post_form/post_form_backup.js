import { setupArtistAutocomplete } from "./artist_autocomplete.js";
import { setupCategoryButtons } from "./category_buttons.js";
import { setupImageUpload } from "./image_upload.js";
import { setupMembersLoader } from "./members_loader.js";
import { setupArtistChangeHandlers } from "./artist_change_handler.js";

document.addEventListener("DOMContentLoaded", () => {
  const ajaxBaseUrl = window.ajaxBaseUrl;
  const selectedMemberIds = window.selectedMemberIds || [];
  const category = document.getElementById("selected-category")?.value || 'sell';

  setupArtistAutocomplete(ajaxBaseUrl);
  setupCategoryButtons(ajaxBaseUrl);
  setupImageUpload({ formId: "create-form" });

  if (category !== "split") {
    setupMembersLoader(ajaxBaseUrl, selectedMemberIds);
  }

  setupArtistChangeHandlers(ajaxBaseUrl);
});