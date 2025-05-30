import { setupArtistAutocomplete } from "./artist_autocomplete.js";
import { setupCategoryButtons } from "./category_buttons.js";
import { setupImageUpload } from "./image_upload.js";
import { setupMembersLoader } from "./members_loader.js";

document.addEventListener("DOMContentLoaded", () => {
  // window 전역변수로 넘어오는 값들
  const ajaxBaseUrl = window.ajaxBaseUrl;
  const selectedMemberIds = window.selectedMemberIds || [];

  setupArtistAutocomplete(ajaxBaseUrl);
  setupCategoryButtons();
  setupImageUpload();
  setupMembersLoader(ajaxBaseUrl, selectedMemberIds);
});
