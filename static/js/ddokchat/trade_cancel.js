// static/js/ddokchat/trade_cancel.js - 새로 생성할 파일

import { showToast, showLoadingToast, hideLoadingToast } from './ui_manager.js';

export function setupTradeCancel() {
  // 전역 함수로 노출
  window.requestTradeCancel = requestTradeCancel;
  window.respondToCancel = respondToCancel;
  window.withdrawCancelRequest = withdrawCancelRequest;
  window.closeHeaderMenu = closeHeaderMenu;
  
  // 모바일 거래 완료 버튼 이벤트 연결
  const mobileCompleteBtn = document.getElementById('mobileCompleteTradeBtn');
  if (mobileCompleteBtn) {
    mobileCompleteBtn.addEventListener('click', function() {
      closeHeaderMenu();
      // 기존 거래 완료 모달 실행
      const completeTradeBtn = document.getElementById('completeTradeBtn');
      if (completeTradeBtn) {
        completeTradeBtn.click();
      }
    });
  }
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

// 헤더 메뉴 닫기
function closeHeaderMenu() {
  const headerDropdownMenu = document.getElementById('headerDropdownMenu');
  if (headerDropdownMenu) {
    headerDropdownMenu.classList.add('hidden');
  }
}

// 거래 취소 요청
function requestTradeCancel() {
  if (!confirm('정말 거래 취소를 요청하시겠습니까?\n\n상대방이 동의해야 취소가 완료됩니다.')) {
    return;
  }
  
  const loadingToast = showLoadingToast('거래 취소 요청 중...');
  const csrfToken = getCSRFToken();
  
  if (!csrfToken) {
    hideLoadingToast(loadingToast);
    showToast('보안 토큰 오류입니다. 페이지를 새로고침해주세요.', 'error');
    return;
  }
  
  fetch(`/ddokchat/cancel/request/${window.roomCode}/`, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken,
      'Content-Type': 'application/json',
    },
  })
  .then(response => response.json())
  .then(data => {
    hideLoadingToast(loadingToast);
    
    if (data.success) {
      showToast(data.message, 'success');
      
      if (data.reload_required) {
        // 페이지 새로고침 또는 동적 업데이트
        setTimeout(() => {
          location.reload();
        }, 1500);
      }
    } else {
      showToast(data.error || '취소 요청에 실패했습니다.', 'error');
    }
  })
  .catch(error => {
    hideLoadingToast(loadingToast);
    console.error('거래 취소 요청 오류:', error);
    showToast('취소 요청 중 오류가 발생했습니다.', 'error');
  });
}

// 거래 취소 응답 (동의/거절)
function respondToCancel(action) {
  const actionText = action === 'accept' ? '동의' : '거절';
  const confirmMessage = action === 'accept' 
    ? '거래 취소에 동의하시겠습니까?\n\n동의하면 거래가 즉시 취소됩니다.'
    : '거래 취소를 거절하시겠습니까?\n\n거절하면 거래가 계속 진행됩니다.';
  
  if (!confirm(confirmMessage)) {
    return;
  }
  
  const loadingToast = showLoadingToast(`취소 ${actionText} 처리 중...`);
  const csrfToken = getCSRFToken();
  
  if (!csrfToken) {
    hideLoadingToast(loadingToast);
    showToast('보안 토큰 오류입니다. 페이지를 새로고침해주세요.', 'error');
    return;
  }
  
  const formData = new FormData();
  formData.append('action', action);
  
  fetch(`/ddokchat/cancel/respond/${window.roomCode}/`, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken,
    },
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    hideLoadingToast(loadingToast);
    
    if (data.success) {
      const toastType = action === 'accept' ? 'success' : 'info';
      showToast(data.message, toastType);
      
      if (data.reload_required) {
        setTimeout(() => {
          location.reload();
        }, 1500);
      }
    } else {
      showToast(data.error || `취소 ${actionText}에 실패했습니다.`, 'error');
    }
  })
  .catch(error => {
    hideLoadingToast(loadingToast);
    console.error('거래 취소 응답 오류:', error);
    showToast(`취소 ${actionText} 중 오류가 발생했습니다.`, 'error');
  });
}

// 거래 취소 요청 철회
function withdrawCancelRequest() {
  if (!confirm('거래 취소 요청을 철회하시겠습니까?\n\n철회 후에는 거래가 정상적으로 진행됩니다.')) {
    return;
  }
  
  const loadingToast = showLoadingToast('취소 요청 철회 중...');
  const csrfToken = getCSRFToken();
  
  if (!csrfToken) {
    hideLoadingToast(loadingToast);
    showToast('보안 토큰 오류입니다. 페이지를 새로고침해주세요.', 'error');
    return;
  }
  
  fetch(`/ddokchat/cancel/withdraw/${window.roomCode}/`, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken,
      'Content-Type': 'application/json',
    },
  })
  .then(response => response.json())
  .then(data => {
    hideLoadingToast(loadingToast);
    
    if (data.success) {
      showToast(data.message, 'info');
      
      if (data.reload_required) {
        setTimeout(() => {
          location.reload();
        }, 1500);
      }
    } else {
      showToast(data.error || '취소 요청 철회에 실패했습니다.', 'error');
    }
  })
  .catch(error => {
    hideLoadingToast(loadingToast);
    console.error('취소 요청 철회 오류:', error);
    showToast('철회 처리 중 오류가 발생했습니다.', 'error');
  });
}