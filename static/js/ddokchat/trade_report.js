// static/js/ddokchat/trade_report.js

import { showToast, showLoadingToast, hideLoadingToast } from './ui_manager.js';

export function setupTradeReport() {
  // 전역 함수로 노출 (템플릿에서 onclick으로 호출하기 위해)
  window.showTradeReportModal = showTradeReportModal;
  window.closeTradeReportModal = closeTradeReportModal;
  window.loadTradeReportForm = loadTradeReportForm;
  window.submitTradeReport = submitTradeReport;
  
  console.log('✅ 거래 신고 모듈 초기화 완료');
}

// CSRF 토큰 가져오는 함수
function getCSRFToken() {
  if (window.csrfToken) {
    return window.csrfToken;
  }
  
  const metaToken = document.querySelector('meta[name="csrf-token"]');
  if (metaToken && metaToken.content) {
    return metaToken.content;
  }
  
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrftoken' && value) {
      return decodeURIComponent(value);
    }
  }
  
  const hiddenInput = document.querySelector('[name=csrfmiddlewaretoken]');
  if (hiddenInput && hiddenInput.value) {
    return hiddenInput.value;
  }
  
  console.error('CSRF 토큰을 찾을 수 없습니다!');
  return null;
}

// 거래 신고 모달 열기
export function showTradeReportModal() {
  const modal = document.getElementById('tradeReportModal');
  const loading = document.getElementById('tradeReportLoading');
  const formContainer = document.getElementById('tradeReportFormContainer');
  const errorDiv = document.getElementById('tradeReportError');
  const footer = document.getElementById('tradeReportFooter');
  
  if (!modal) {
    console.error('신고 모달을 찾을 수 없습니다.');
    return;
  }
  
  // 초기 상태로 리셋
  loading?.classList.remove('hidden');
  formContainer?.classList.add('hidden');
  errorDiv?.classList.add('hidden');
  footer?.classList.add('hidden');
  
  // 모달 표시
  modal.classList.remove('hidden');
  
  // 폼 로드 시작
  loadTradeReportForm();
}

// 거래 신고 모달 닫기
export function closeTradeReportModal() {
  const modal = document.getElementById('tradeReportModal');
  if (modal) {
    modal.classList.add('hidden');
    
    // 폼 내용 초기화
    const formContainer = document.getElementById('tradeReportFormContainer');
    if (formContainer) {
      formContainer.innerHTML = '';
    }
  }
}

// 신고 폼 로드
function loadTradeReportForm() {
  const roomId = window.roomId;
  if (!roomId) {
    showTradeReportError('채팅방 정보를 찾을 수 없습니다.');
    return;
  }
  
  const loading = document.getElementById('tradeReportLoading');
  const formContainer = document.getElementById('tradeReportFormContainer');
  const errorDiv = document.getElementById('tradeReportError');
  const footer = document.getElementById('tradeReportFooter');
  
  // 로딩 상태 표시
  loading?.classList.remove('hidden');
  formContainer?.classList.add('hidden');
  errorDiv?.classList.add('hidden');
  footer?.classList.add('hidden');
  
  // AJAX로 폼 로드
  fetch(`/ddokchat/report-form/${roomId}/`, {
    method: 'GET',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    }
  })
  .then(response => response.json())
  .then(data => {
    loading?.classList.add('hidden');
    
    if (data.success) {
      // 폼 HTML 삽입
      if (formContainer) {
        formContainer.innerHTML = data.form_html;
        formContainer.classList.remove('hidden');
      }
      
      // 푸터 표시
      footer?.classList.remove('hidden');
      
      // 폼 제출 버튼 이벤트 등록
      setupFormSubmission();
      
    } else {
      showTradeReportError(data.error || '폼을 불러오는데 실패했습니다.');
    }
  })
  .catch(error => {
    console.error('폼 로드 오류:', error);
    loading?.classList.add('hidden');
    showTradeReportError('네트워크 오류가 발생했습니다.');
  });
}

// 에러 상태 표시
function showTradeReportError(message) {
  const errorDiv = document.getElementById('tradeReportError');
  const errorMessage = document.getElementById('tradeReportErrorMessage');
  
  if (errorDiv && errorMessage) {
    errorMessage.textContent = message;
    errorDiv.classList.remove('hidden');
  }
}

// 폼 제출 이벤트 설정
function setupFormSubmission() {
  const submitBtn = document.getElementById('submitTradeReportBtn');
  
  if (submitBtn) {
    submitBtn.onclick = submitTradeReport;
  }
  
  // 엔터키 제출 방지 (라디오 버튼 등에서 엔터를 누르면 제출되는 것 방지)
  const form = document.getElementById('tradeReportForm');
  if (form) {
    form.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
    });
  }
}

// 신고 제출
function submitTradeReport() {
  const roomId = window.roomId;
  const form = document.getElementById('tradeReportForm');
  const submitBtn = document.getElementById('submitTradeReportBtn');
  
  if (!roomId || !form) {
    showToast('폼 정보를 찾을 수 없습니다.', 'error');
    return;
  }
  
  // 폼 데이터 수집
  const formData = new FormData(form);
  
  // 필수 필드 검증
  const reason = formData.get('reason');
  const description = formData.get('description');
  
  if (!reason) {
    showToast('신고 사유를 선택해주세요.', 'error');
    return;
  }
  
  if (!description || description.trim().length < 10) {
    showToast('신고 내용을 10자 이상 구체적으로 작성해주세요.', 'error');
    return;
  }
  
  // 버튼 비활성화
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '제출 중...';
  }
  
  const csrfToken = getCSRFToken();
  if (!csrfToken) {
    showToast('보안 토큰 오류입니다. 페이지를 새로고침해주세요.', 'error');
    resetSubmitButton();
    return;
  }
  
  // 서버로 전송
  fetch(`/ddokchat/report-trade/${roomId}/`, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken,
    },
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showToast(data.message || '신고가 접수되었습니다.', 'success');
      closeTradeReportModal();
    } else {
      showToast(data.error || '신고 처리에 실패했습니다.', 'error');
      
      // 폼 에러 표시
      if (data.form_errors) {
        displayFormErrors(data.form_errors);
      }
    }
  })
  .catch(error => {
    console.error('신고 제출 오류:', error);
    showToast('신고 처리 중 오류가 발생했습니다.', 'error');
  })
  .finally(() => {
    resetSubmitButton();
  });
}

// 제출 버튼 리셋
function resetSubmitButton() {
  const submitBtn = document.getElementById('submitTradeReportBtn');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = '신고 제출';
  }
}

// 폼 에러 표시
function displayFormErrors(errors) {
  // 기존 에러 메시지 제거
  document.querySelectorAll('.form-error-message').forEach(el => el.remove());
  
  for (const [field, fieldErrors] of Object.entries(errors)) {
    const fieldElement = document.querySelector(`[name="${field}"]`);
    if (fieldElement && fieldErrors.length > 0) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'form-error-message text-red-600 text-sm mt-1';
      errorDiv.textContent = fieldErrors[0]; // 첫 번째 에러만 표시
      
      // 필드 다음에 에러 메시지 삽입
      fieldElement.parentNode.insertBefore(errorDiv, fieldElement.nextSibling);
    }
  }
}