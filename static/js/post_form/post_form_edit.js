// static/js/post_form/post_form_edit.js - 수정된 버전
import { setupImageUpload } from "./image_upload.js";
import { setupMembersLoader } from "./members_loader.js";
import { setupPriceHandlers } from "./price_handler.js";
import memberSelectAllManager from "./member_select_all.js"; // ✅ 추가

document.addEventListener("DOMContentLoaded", () => {
  const ajaxBaseUrl = window.ajaxBaseUrl;
  const selectedMemberIds = window.selectedMemberIds || [];
  const existingImages = window.existingImages || [];
  const category = document.getElementById("selected-category")?.value || 'sell';

  // ✅ 전체선택 관리자 초기화 (가장 먼저)
  memberSelectAllManager.initialize();

  // 기존 이미지와 함께 이미지 업로드 기능 설정
  setupImageUpload({ 
    formId: "edit-form", 
    existingImages: existingImages,
    removedInputName: "removed_image_ids"
  });

  // 가격 처리 기능 (판매/대여 카테고리에만)
  if (category === 'sell' || category === 'rental') {
    setupPriceHandlers();
  }

  // 아티스트 선택 비활성화 (수정 모드에서는 변경 불가)
  disableArtistSelection();

  // 멤버 로더 설정 (split이 아닌 경우만)
  if (category !== "split") {
    setupMembersLoader(ajaxBaseUrl, selectedMemberIds);
  }

  // 카테고리 버튼 비활성화 (수정 페이지에서는 카테고리 변경 불가)
  disableCategoryButtons();

  // 폼 제출 시 validation
  setupFormValidation();
});

// 아티스트 선택 비활성화
function disableArtistSelection() {
  const artistSelect = document.getElementById("artist");
  const artistSearchInput = document.getElementById("artist-search");
  const artistSearchResults = document.getElementById("artist-search-results");
  
  if (artistSelect) {
    artistSelect.disabled = true;
    artistSelect.style.backgroundColor = '#f3f4f6';
    artistSelect.style.color = '#6b7280';
    artistSelect.style.cursor = 'not-allowed';
  }
  
  if (artistSearchInput) {
    artistSearchInput.disabled = true;
    artistSearchInput.placeholder = '수정 시에는 아티스트 변경 불가';
    artistSearchInput.style.backgroundColor = '#f3f4f6';
    artistSearchInput.style.color = '#6b7280';
    artistSearchInput.style.cursor = 'not-allowed';
  }
  
  if (artistSearchResults) {
    artistSearchResults.classList.add('hidden');
  }
}

// 카테고리 버튼 비활성화
function disableCategoryButtons() {
  const categoryButtons = document.querySelectorAll(".category-btn");
  categoryButtons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
    btn.style.pointerEvents = 'none';
    btn.title = '수정 시에는 카테고리를 변경할 수 없습니다';
  });
}

// 폼 제출 validation
function setupFormValidation() {
  const form = document.getElementById("edit-form");
  if (form) {
    form.addEventListener("submit", function(e) {
      const imagePreview = document.getElementById("image-preview-list");
      const hasImages = imagePreview && imagePreview.querySelectorAll("img").length > 0;
      
      if (!hasImages) {
        e.preventDefault();
        alert("이미지는 최소 1장 이상 업로드해야 합니다.");
        return false;
      }
      
      console.log('Form validation passed, submitting...');
    });
  }
}