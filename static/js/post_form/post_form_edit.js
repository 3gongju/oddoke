// static/js/post_form/post_form_edit.js - 수정 페이지 전용
import { setupImageUpload } from "./image_upload.js";
import { setupMembersLoader } from "./members_loader.js";
import { setupPriceHandlers } from "./price_handler.js";

document.addEventListener("DOMContentLoaded", () => {
  const ajaxBaseUrl = window.ajaxBaseUrl;
  const selectedMemberIds = window.selectedMemberIds || [];
  const existingImages = window.existingImages || [];
  const category = document.getElementById("selected-category")?.value || 'sell';

  console.log('Edit form initialized with category:', category);
  console.log('Existing item prices from window:', window.existingItemPrices);

  // 기존 이미지와 함께 이미지 업로드 기능 설정
  setupImageUpload({ 
    formId: "edit-form", 
    existingImages: existingImages,
    removedInputName: "removed_image_ids"
  });

  // 가격 처리 기능 (판매/대여 카테고리에만)
  if (category === 'sell' || category === 'rental') {
    // 가격 핸들러 설정 전에 데이터 확인
    console.log('Setting up price handlers for category:', category);
    setupPriceHandlers();
  }

  // 아티스트 선택 비활성화 (수정 모드에서는 변경 불가)
  disableArtistSelection();

  // 멤버 로더 설정 (split이 아닌 경우만)
  if (category !== "split") {
    setupMembersLoader(ajaxBaseUrl, selectedMemberIds);
    
    // 멤버 로딩 완료 후 전체 선택 기능 재설정
    setTimeout(() => {
      setupMemberSelectAll();
    }, 1000);
  }

  // 멤버 전체 선택 기능 설정 (초기)
  setupMemberSelectAll();

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
    // select 요소 비활성화 (스타일링은 CSS에서 처리)
    artistSelect.disabled = true;
    artistSelect.style.backgroundColor = '#f3f4f6';
    artistSelect.style.color = '#6b7280';
    artistSelect.style.cursor = 'not-allowed';
  }
  
  // 아티스트 검색 입력창 비활성화
  if (artistSearchInput) {
    artistSearchInput.disabled = true;
    artistSearchInput.placeholder = '수정 시에는 아티스트 변경 불가';
    artistSearchInput.style.backgroundColor = '#f3f4f6';
    artistSearchInput.style.color = '#6b7280';
    artistSearchInput.style.cursor = 'not-allowed';
  }
  
  // 검색 결과 숨김
  if (artistSearchResults) {
    artistSearchResults.classList.add('hidden');
  }
}

// 멤버 전체 선택 기능 (지연 실행 및 재시도 로직 포함)
function setupMemberSelectAll() {
  // 지연 실행으로 DOM이 완전히 로드된 후 실행
  setTimeout(() => {
    const selectAllCheckbox = document.getElementById('select-all-members');
    const memberCheckboxes = document.querySelectorAll('.member-checkbox');
    
    console.log('setupMemberSelectAll - selectAll:', !!selectAllCheckbox, 'members:', memberCheckboxes.length);
    
    if (selectAllCheckbox && memberCheckboxes.length > 0) {
      // 기존 이벤트 리스너 제거 (중복 방지)
      selectAllCheckbox.removeEventListener('change', handleSelectAllChange);
      
      // 전체 선택 체크박스 이벤트
      selectAllCheckbox.addEventListener('change', handleSelectAllChange);
      
      // 개별 체크박스 이벤트 (기존 이벤트 리스너 제거 후 재등록)
      memberCheckboxes.forEach(checkbox => {
        checkbox.removeEventListener('change', handleMemberCheckboxChange);
        checkbox.addEventListener('change', handleMemberCheckboxChange);
      });
      
      // 초기 상태 설정
      updateSelectAllState();
      
      console.log('✅ Member select all functionality initialized');
    } else {
      console.log('⚠️ Member checkboxes not found, retrying...');
      
      // 3초 후 재시도 (AJAX 로딩 대기)
      setTimeout(() => {
        const retrySelectAll = document.getElementById('select-all-members');
        const retryMembers = document.querySelectorAll('.member-checkbox');
        
        if (retrySelectAll && retryMembers.length > 0) {
          console.log('🔄 Retrying member select all setup...');
          setupMemberSelectAll();
        } else {
          console.log('❌ Member checkboxes still not found after retry');
        }
      }, 3000);
    }
  }, 500); // 500ms 지연
  
  // 이벤트 핸들러 함수들
  function handleSelectAllChange() {
    const memberCheckboxes = document.querySelectorAll('.member-checkbox');
    memberCheckboxes.forEach(checkbox => {
      checkbox.checked = this.checked;
    });
  }
  
  function handleMemberCheckboxChange() {
    updateSelectAllState();
  }
  
  function updateSelectAllState() {
    const selectAllCheckbox = document.getElementById('select-all-members');
    const memberCheckboxes = document.querySelectorAll('.member-checkbox');
    
    if (!selectAllCheckbox || memberCheckboxes.length === 0) return;
    
    const checkedCount = document.querySelectorAll('.member-checkbox:checked').length;
    const totalCount = memberCheckboxes.length;
    
    if (checkedCount === 0) {
      selectAllCheckbox.indeterminate = false;
      selectAllCheckbox.checked = false;
    } else if (checkedCount === totalCount) {
      selectAllCheckbox.indeterminate = false;
      selectAllCheckbox.checked = true;
    } else {
      selectAllCheckbox.indeterminate = true;
      selectAllCheckbox.checked = false;
    }
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
    
    // 툴팁 추가
    btn.title = '수정 시에는 카테고리를 변경할 수 없습니다';
  });
}

// 폼 제출 validation
function setupFormValidation() {
  const form = document.getElementById("edit-form");
  if (form) {
    form.addEventListener("submit", function(e) {
      // 이미지 최소 1장 확인
      const imagePreview = document.getElementById("image-preview-list");
      const hasImages = imagePreview && imagePreview.querySelectorAll("img").length > 0;
      
      if (!hasImages) {
        e.preventDefault();
        alert("이미지는 최소 1장 이상 업로드해야 합니다.");
        return false;
      }
      
      // 추가 validation이 필요하면 여기에 추가
      console.log('Form validation passed, submitting...');
    });
  }
}