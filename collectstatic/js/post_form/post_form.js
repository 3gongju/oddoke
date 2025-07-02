// static/js/post_form/post_form.js - 수정된 버전

import { setupArtistAutocomplete } from "./artist_autocomplete.js";
import { setupCategoryButtons } from "./category_buttons.js";
import { setupImageUpload } from "./image_upload.js";
import { setupMembersLoader } from "./members_loader.js";
import { setupArtistChangeHandlers } from "./artist_change_handler.js";
import { setupDdoksangCafeAutocomplete } from "./cafe_autocomplete.js";
import { setupPriceHandlers } from "./price_handler.js";
import memberSelectAllManager from "./member_select_all.js"; // ✅ 추가

document.addEventListener("DOMContentLoaded", () => {
  const ajaxBaseUrl = window.ajaxBaseUrl;
  const selectedMemberIds = window.selectedMemberIds || [];
  const category = document.getElementById("selected-category")?.value || 'community';

  console.log('🚀 Post form initialized with category:', category);

  // ✅ 전체선택 관리자 초기화 (가장 먼저)
  memberSelectAllManager.initialize();

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
  
  // 가격 처리 기능 추가 (판매/대여 카테고리에만)
  if (category === 'sell' || category === 'rental') {
    setupPriceHandlers();
  }

  console.log('✅ All post form features initialized');
});