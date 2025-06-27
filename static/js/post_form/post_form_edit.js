// static/js/post_form/post_form_edit.js - 기존 코드에 덕생 카페 자동완성만 추가

import { setupArtistAutocomplete } from "./artist_autocomplete.js";
import { setupCategoryButtons } from "./category_buttons.js";
import { setupImageUpload } from "./image_upload.js";
import { setupMembersLoader } from "./members_loader.js";
import { setupDdoksangCafeAutocomplete } from "./cafe_autocomplete.js"; // 새로 추가
import { setupPriceHandlers } from "./price_handler.js"; // 새로 추가

document.addEventListener("DOMContentLoaded", () => {
  const ajaxBaseUrl = window.ajaxBaseUrl;
  const selectedMemberIds = window.selectedMemberIds || [];
  const existingImages = window.existingImages || [];

 
  setupArtistAutocomplete(ajaxBaseUrl);
  setupCategoryButtons(ajaxBaseUrl);
  setupImageUpload({ formId: "edit-form", existingImages });
  setupMembersLoader(ajaxBaseUrl, selectedMemberIds);
  
  // 덕생 카페 자동완성 (bdaycafe 카테고리에서만 작동)
  setupDdoksangCafeAutocomplete();

  // 가격 처리 기능 추가 (판매/대여 카테고리에만)
  if (category === 'sell' || category === 'rental') {
    setupPriceHandlers();
  }
});