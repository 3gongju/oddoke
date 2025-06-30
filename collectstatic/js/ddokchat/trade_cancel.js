// static/js/ddokchat/trade_cancel.js - 모달 방식으로 수정

export function setupTradeCancel() {
  setupTradeCancelModals();
  
  // 전역 함수로 노출
  window.requestTradeCancel = requestTradeCancel;
  window.respondToCancel = respondToCancel;
  window.withdrawCancelRequest = withdrawCancelRequest;
  window.closeHeaderMenu = closeHeaderMenu;
}

function setupTradeCancelModals() {
  // 거래 취소 요청 모달
  const cancelRequestModal = document.getElementById('cancelRequestModal');
  const cancelRequestCancel = document.getElementById('cancelRequestCancel');
  const cancelRequestConfirm = document.getElementById('cancelRequestConfirm');
  
  // 거래 취소 응답 모달
  const cancelResponseModal = document.getElementById('cancelResponseModal');
  const cancelResponseReject = document.getElementById('cancelResponseReject');
  const cancelResponseAccept = document.getElementById('cancelResponseAccept');
  
  // 거래 취소 철회 모달
  const cancelWithdrawModal = document.getElementById('cancelWithdrawModal');
  const cancelWithdrawCancel = document.getElementById('cancelWithdrawCancel');
  const cancelWithdrawConfirm = document.getElementById('cancelWithdrawConfirm');

  // 취소 요청 모달 이벤트
  if (cancelRequestCancel) {
    cancelRequestCancel.addEventListener('click', () => {
      cancelRequestModal.classList.add('hidden');
    });
  }
  
  if (cancelRequestConfirm) {
    cancelRequestConfirm.addEventListener('click', () => {
      cancelRequestModal.classList.add('hidden');
      executeTradeCancel('request');
    });
  }

  // 취소 응답 모달 이벤트
  if (cancelResponseReject) {
    cancelResponseReject.addEventListener('click', () => {
      cancelResponseModal.classList.add('hidden');
      executeTradeCancel('reject');
    });
  }
  
  if (cancelResponseAccept) {
    cancelResponseAccept.addEventListener('click', () => {
      cancelResponseModal.classList.add('hidden');
      executeTradeCancel('accept');
    });
  }

  // 취소 철회 모달 이벤트
  if (cancelWithdrawCancel) {
    cancelWithdrawCancel.addEventListener('click', () => {
      cancelWithdrawModal.classList.add('hidden');
    });
  }
  
  if (cancelWithdrawConfirm) {
    cancelWithdrawConfirm.addEventListener('click', () => {
      cancelWithdrawModal.classList.add('hidden');
      executeTradeCancel('withdraw');
    });
  }

  // 모달 외부 클릭 시 닫기
  [cancelRequestModal, cancelResponseModal, cancelWithdrawModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    }
  });
}

function requestTradeCancel() {
  const modal = document.getElementById('cancelRequestModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function respondToCancel(action) {
  if (action === 'accept' || action === 'reject') {
    const modal = document.getElementById('cancelResponseModal');
    if (modal) {
      // 응답 액션을 모달에 저장
      modal.setAttribute('data-action', action);
      modal.classList.remove('hidden');
    }
  }
}

function withdrawCancelRequest() {
  const modal = document.getElementById('cancelWithdrawModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function executeTradeCancel(action) {
  const roomCode = window.roomCode;
  const csrfToken = getCSRFToken();
  
  if (!csrfToken) {
    showToast('보안 토큰 오류입니다. 페이지를 새로고침해주세요.', 'error');
    return;
  }

  let url, data;
  
  switch (action) {
    case 'request':
      url = `/ddokchat/cancel/request/${roomCode}/`;
      data = {};
      break;
    case 'accept':
      url = `/ddokchat/cancel/respond/${roomCode}/`;
      data = { action: 'accept' };
      break;
    case 'reject':
      url = `/ddokchat/cancel/respond/${roomCode}/`;
      data = { action: 'reject' };
      break;
    case 'withdraw':
      url = `/ddokchat/cancel/withdraw/${roomCode}/`;
      data = {};
      break;
    default:
      console.error('알 수 없는 액션:', action);
      return;
  }

  // 로딩 토스트 표시
  const loadingToast = showLoadingToast('처리 중...');

  fetch(url, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(data)
  })
  .then(response => response.json())
  .then(data => {
    hideLoadingToast(loadingToast);
    
    if (data.success) {
      showToast(data.message, 'success');
      
      if (data.reload_required) {
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } else {
      showToast(data.error || '처리 중 오류가 발생했습니다.', 'error');
    }
  })
  .catch(error => {
    hideLoadingToast(loadingToast);
    console.error('거래 취소 처리 오류:', error);
    showToast('처리 중 오류가 발생했습니다.', 'error');
  });
}

function closeHeaderMenu() {
  const dropdown = document.getElementById('headerDropdownMenu');
  if (dropdown) {
    dropdown.classList.add('hidden');
  }
}

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

// UI 매니저에서 가져올 함수들 (import 대신 전역 참조)
function showToast(message, type) {
  if (window.showToast) {
    window.showToast(message, type);
  } else {
    console.log(`Toast: ${message} (${type})`);
  }
}

function showLoadingToast(message) {
  if (window.showLoadingToast) {
    return window.showLoadingToast(message);
  } else {
    console.log(`Loading: ${message}`);
    return null;
  }
}

function hideLoadingToast(toast) {
  if (window.hideLoadingToast && toast) {
    window.hideLoadingToast(toast);
  }
}