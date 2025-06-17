// static/js/post_form/post_form.js - 기존 기능 유지하면서 안전하게 확장

import { setupArtistAutocomplete } from "./artist_autocomplete.js";
import { setupCategoryButtons } from "./category_buttons.js";
import { setupImageUpload } from "./image_upload.js";
import { setupMembersLoader } from "./members_loader.js";
import { setupArtistChangeHandlers } from "./artist_change_handler.js";
import { setupDdoksangCafeAutocomplete } from "./cafe_autocomplete.js";

document.addEventListener("DOMContentLoaded", () => {
  const ajaxBaseUrl = window.ajaxBaseUrl;
  const selectedMemberIds = window.selectedMemberIds || [];
  const category = document.getElementById("selected-category")?.value || 'community';

  // 기존 기능들 유지
  setupArtistAutocomplete(ajaxBaseUrl);
  setupCategoryButtons(ajaxBaseUrl);
  setupImageUpload({ formId: "create-form" });

  if (category !== "split") {
    setupMembersLoader(ajaxBaseUrl, selectedMemberIds);
  }

  setupArtistChangeHandlers(ajaxBaseUrl);
  
  // 생카후기 카테고리일 때만 덕생 카페 자동완성 활성화
  setupDdoksangCafeAutocomplete();
});