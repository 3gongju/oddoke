import { setupArtistAutocomplete } from "./artist_autocomplete.js";
import { setupCategoryButtons } from "./category_buttons.js";
import { setupImageUpload } from "./image_upload.js";
import { setupMembersLoader } from "./members_loader.js";
import { setupArtistChangeHandlers } from "./artist_change_handler.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("🔥 JS loaded!");
  const ajaxBaseUrl = window.ajaxBaseUrl;
  const selectedMemberIds = window.selectedMemberIds || [];
  const category = document.getElementById("selected-category").value;

  setupArtistAutocomplete(ajaxBaseUrl);
  setupCategoryButtons(ajaxBaseUrl);  // ✅ ajaxBaseUrl 넘겨주기!
  setupImageUpload({ formId: "create-form" });

  // ✅ split이 아닐 때만 멤버 로더 실행
  if (category !== "split") {
    setupMembersLoader(ajaxBaseUrl, selectedMemberIds);
  }

  // ✅ 항상 artistChangeHandlers는 실행 (split/sell/rental 다 처리)
  setupArtistChangeHandlers(ajaxBaseUrl, selectedMemberIds);
});
