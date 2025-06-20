// static/js/ddokchat/ui_setup.js

import { showToast, showLoadingToast, hideLoadingToast, updateUIAfterTradeComplete } from './ui_manager.js';
import { handleImageUpload } from './image_handler.js';
import { sendAccountInfo, sendAddressInfo } from './message_sender.js';

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

// 플러스 메뉴 설정
export function setupPlusMenu() {
  const plusMenuBtn = document.getElementById('plus-menu-btn');
  const plusMenu = document.getElementById('plus-menu');
  const sendImageBtn = document.getElementById('send-image-btn');
  const sendAccountBtn = document.getElementById('send-account-btn');
  const sendAddressBtn = document.getElementById('send-address-btn');
  const imageUpload = document.getElementById('chat-image-upload');

  if (plusMenuBtn && plusMenu) {
    plusMenuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      plusMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', function(e) {
      if (!plusMenu.contains(e.target) && !plusMenuBtn.contains(e.target)) {
        plusMenu.classList.add('hidden');
      }
    });

    plusMenu.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  }

  if (sendImageBtn && imageUpload) {
    sendImageBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (plusMenu) plusMenu.classList.add('hidden');
      imageUpload.click();
    });

    imageUpload.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        handleImageUpload(file);
        e.target.value = '';
      }
    });
  }

  if (sendAccountBtn) {
    sendAccountBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (plusMenu) plusMenu.classList.add('hidden');
      sendAccountInfo();
    });
  }

  if (sendAddressBtn) {
    sendAddressBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (plusMenu) plusMenu.classList.add('hidden');
      sendAddressInfo();
    });
  }
}

// 거래 완료 모달 설정
export function setupTradeCompleteModal() {
  const completeTradeBtn = document.getElementById('completeTradeBtn');
  const confirmModal = document.getElementById('confirmModal');
  const cancelBtn = document.getElementById('cancelBtn');
  const confirmBtn = document.getElementById('confirmBtn');

  if (completeTradeBtn) {
    completeTradeBtn.addEventListener('click', function() {
      if (confirmModal) {
        confirmModal.classList.remove('hidden');
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      if (confirmModal) {
        confirmModal.classList.add('hidden');
      }
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', function() {
      confirmBtn.disabled = true;
      const originalText = confirmBtn.textContent;
      confirmBtn.textContent = '처리 중...';
      
      const csrfToken = getCSRFToken();
      if (!csrfToken) {
        showToast('보안 토큰 오류입니다. 페이지를 새로고침해주세요.', 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalText;
        return;
      }
      
      fetch(`/ddokchat/complete/${window.roomId}/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrfToken,
          'Content-Type': 'application/json',
        },
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          updateUIAfterTradeComplete(data.is_fully_completed);
          if (confirmModal) {
            confirmModal.classList.add('hidden');
          }
        } else {
          throw new Error(data.error || "처리 중 오류가 발생했습니다.");
        }
      })
      .catch(error => {
        console.error('Error:', error);
        showToast(error.message || '처리 중 오류가 발생했습니다.', 'error');
        
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalText;
      });
    });
  }

  if (confirmModal) {
    confirmModal.addEventListener('click', function(e) {
      if (e.target === confirmModal) {
        confirmModal.classList.add('hidden');
      }
    });
  }
}

// 헤더 메뉴 설정
export function setupHeaderMenu() {
  const headerMenuBtn = document.getElementById('headerMenuBtn');
  const headerDropdownMenu = document.getElementById('headerDropdownMenu');
  const viewUserInfoBtn = document.getElementById('viewUserInfoBtn');
  const reportUserBtn = document.getElementById('reportUserBtn');

  if (headerMenuBtn && headerDropdownMenu) {
    headerMenuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      headerDropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', function(e) {
      if (!headerDropdownMenu.contains(e.target) && !headerMenuBtn.contains(e.target)) {
        headerDropdownMenu.classList.add('hidden');
      }
    });

    headerDropdownMenu.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  }

  if (viewUserInfoBtn) {
    viewUserInfoBtn.addEventListener('click', function() {
      headerDropdownMenu.classList.add('hidden');
      showUserInfo();
    });
  }

  if (reportUserBtn) {
    reportUserBtn.addEventListener('click', function() {
      headerDropdownMenu.classList.add('hidden');
      showReportModal();
    });
  }
}

// 거래자 정보 보기 함수
function showUserInfo() {
  const otherUser = getOtherUserUsername();
  
  if (otherUser) {
    window.location.href = `/accounts/profile/${otherUser}/`;
  } else {
    showToast('사용자 정보를 찾을 수 없습니다.', 'error');
  }
}

// 신고하기 함수
function showReportModal() {
  const otherUser = getOtherUserUsername();
  
  if (!otherUser) {
    showToast('신고할 사용자 정보를 찾을 수 없습니다.', 'error');
    return;
  }
  
  if (confirm(`'${otherUser}' 사용자를 신고하시겠습니까?\n\n신고 사유:\n• 사기/허위 거래\n• 욕설/비방\n• 불법 상품 거래\n• 기타 부적절한 행위\n\n신고 후 관리자가 검토합니다.`)) {
    handleUserReport(otherUser);
  }
}

// 상대방 사용자명 가져오기 함수
function getOtherUserUsername() {
  const userNameElement = document.querySelector('.bg-gray-50 h2.font-semibold');
  if (userNameElement) {
    return userNameElement.textContent.trim();
  }
  
  if (window.otherUser) {
    return window.otherUser;
  }
  
  return null;
}

// 신고 처리 함수
function handleUserReport(username) {
  const loadingToast = showLoadingToast('신고 접수 중...');
  
  const csrfToken = getCSRFToken();
  if (!csrfToken) {
    hideLoadingToast(loadingToast);
    showToast('보안 토큰 오류입니다. 페이지를 새로고침해주세요.', 'error');
    return;
  }

  fetch('/accounts/report/', {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reported_user: username,
      report_type: 'chat_abuse',
      room_id: window.roomId,
      description: '채팅방에서 신고'
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    hideLoadingToast(loadingToast);
    
    if (data.success) {
      showToast('신고가 접수되었습니다. 검토 후 조치하겠습니다.', 'success');
    } else {
      showToast(data.error || '신고 접수에 실패했습니다.', 'error');
    }
  })
  .catch(error => {
    hideLoadingToast(loadingToast);
    console.error('신고 처리 오류:', error);
    
    if (error.message.includes('404') || error.message.includes('405')) {
      showToast('신고 기능이 준비 중입니다. 고객센터로 문의해주세요.', 'info');
    } else {
      showToast('신고 처리 중 오류가 발생했습니다.', 'error');
    }
  });
}

// 리뷰 모달 관련 처리
export function setupReviewModal() {
  const hasAlreadyReviewed = window.hasAlreadyReviewed || false;
  const isFullyCompleted = window.isFullyCompleted || false;
  const isBuyer = window.currentUser === window.roomBuyer;

  if (isFullyCompleted && isBuyer && !hasAlreadyReviewed) {
    const reviewModal = document.getElementById("reviewModal");
    if (reviewModal) {
      try {
        reviewModal.showModal();
      } catch (e) {
        reviewModal.style.display = "block";
      }
    }
  }
}