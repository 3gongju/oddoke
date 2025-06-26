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
      
      fetch(`/ddokchat/complete/${window.roomCode}/`, {
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

// 헤더 메뉴 설정 - 🔥 신고 로직 간소화
export function setupHeaderMenu() {
  const headerMenuBtn = document.getElementById('headerMenuBtn');
  const headerDropdownMenu = document.getElementById('headerDropdownMenu');
  const viewUserInfoBtn = document.getElementById('viewUserInfoBtn');
  // 🔥 reportUserBtn은 chat_room.html에서 직접 처리하므로 여기서는 제거

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

// 리뷰 모달 관련 처리 - 🔥 주석 해제
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