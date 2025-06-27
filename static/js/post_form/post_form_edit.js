import { setupImagePreview } from "./image_preview";
import { setupPriceHandlers } from "./price_handler";
import { setupCategoryButtons } from "./category_buttons";
import { setupMemberCheckboxes } from "./member_checkboxes";
import { setupFormSubmission } from "./form_submit";

document.addEventListener("DOMContentLoaded", () => {
  const ajaxBaseUrl = window.ajaxBaseUrl;
  const selectedMemberIds = window.selectedMemberIds || [];
  const existingImages = window.existingImages || [];
  
  // 🔧 기존 ItemPrice 데이터 전역 변수로 설정
  const existingItemPrices = window.existingItemPrices || [];
  console.log('Edit mode - existing item prices:', existingItemPrices);

  // category 값 추가 (핵심)
  const category = document.getElementById("selected-category")?.value || 'community';

  // 기존 이미지 미리보기
  setupImagePreview(existingImages);

  // 🔧 덕템 가격 필드 (단일/다중 모드 전환) - 기존 데이터와 함께 초기화
  if (category === 'sell' || category === 'rental') {
    // 기존 데이터를 전역 변수로 설정한 후 가격 핸들러 실행
    window.existingItemPrices = existingItemPrices;
    setupPriceHandlers();
  }

  // 카테고리 버튼 비활성화 (수정 페이지에서는 선택 불가)
  const buttons = document.querySelectorAll(".category-btn");
  buttons.forEach(btn => btn.classList.add("pointer-events-none", "opacity-50"));

  // 멤버 전체 선택 등 체크박스
  setupMemberCheckboxes(category, selectedMemberIds);

  // 폼 제출
  setupFormSubmission();
});