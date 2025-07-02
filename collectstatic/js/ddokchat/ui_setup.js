// static/js/ddokchat/ui_setup.js

import { showToast, showLoadingToast, hideLoadingToast, updateUIAfterTradeComplete } from './ui_manager.js';
import { handleImageUpload } from './image_handler.js';
import { sendBankInfo, sendAddressInfo } from './message_sender.js';

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
  const sendBankBtn = document.getElementById('send-bank-btn');
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

  if (sendBankBtn) {
    sendBankBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (plusMenu) plusMenu.classList.add('hidden');
      sendBankInfo();
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

// 🔥 개선된 거래 완료 모달 설정 - 즉시 UI 업데이트
export function setupTradeCompleteModal() {
  const completeTradeBtn = document.getElementById('completeTradeBtn');
  const mobileCompleteTradeBtn = document.getElementById('mobileCompleteTradeBtn');
  const confirmModal = document.getElementById('confirmModal');
  const cancelBtn = document.getElementById('cancelBtn');
  const confirmBtn = document.getElementById('confirmBtn');
  const buyerMessage = document.getElementById('buyerMessage');
  const sellerMessage = document.getElementById('sellerMessage');

  // 사용자 역할 확인 함수
  function getUserRole() {
    const currentUser = window.currentUser;
    const roomBuyer = window.roomBuyer;
    return currentUser === roomBuyer ? 'buyer' : 'seller';
  }

  // 모달 열기 함수
  function openTradeCompleteModal() {
    if (confirmModal && buyerMessage && sellerMessage) {
      const userRole = getUserRole();
      
      if (userRole === 'buyer') {
        buyerMessage.classList.remove('hidden');
        sellerMessage.classList.add('hidden');
      } else {
        sellerMessage.classList.remove('hidden');
        buyerMessage.classList.add('hidden');
      }
      
      confirmModal.classList.remove('hidden');
    }
  }

  // 데스크탑 거래완료 버튼
  if (completeTradeBtn) {
    completeTradeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      openTradeCompleteModal();
    });
  }

  // 모바일 거래완료 버튼
  if (mobileCompleteTradeBtn) {
    mobileCompleteTradeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      openTradeCompleteModal();
      const dropdown = document.getElementById('headerDropdownMenu');
      if (dropdown) dropdown.classList.add('hidden');
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
      
      const userRole = getUserRole();
      const isBuyer = userRole === 'buyer';
      
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
          // 🔥 즉시 모달 닫기
          if (confirmModal) {
            confirmModal.classList.add('hidden');
          }
          
          // 🔥 API 응답으로 즉시 UI 업데이트
          if (data.ui_update) {
            updateTradeStatusImmediate(data.ui_update, data.is_fully_completed);
          }
          
          if (data.is_fully_completed) {
            // 양쪽 모두 완료
            showToast('거래가 완료되었습니다!', 'success');
            
            // 🔥 구매자가 마지막에 완료하는 경우 즉시 리뷰 모달 표시
            if (isBuyer) {
              const hasAlreadyReviewed = window.hasAlreadyReviewed || false;
              if (!hasAlreadyReviewed) {
                setTimeout(() => {
                  if (window.showReviewRedirectModal) {
                    window.showReviewRedirectModal();
                  }
                }, 1500);
              }
            }
          } else {
            // 한쪽만 완료 - 역할별 즉시 피드백
            if (isBuyer) {
              showToast('거래완료 요청을 보냈습니다. 판매자의 확인을 기다려주세요.', 'success');
            } else {
              showToast('거래완료 처리되었습니다. 구매자의 확인을 기다려주세요.', 'success');
            }
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

// 🔥 NEW: 즉시 UI 업데이트 함수
function updateTradeStatusImmediate(uiData, isFullyCompleted) {
  const tradeStatusContainer = document.getElementById('tradeStatusContainer');
  
  if (tradeStatusContainer) {
    // 데스크탑/모바일 상태 텍스트 업데이트
    const desktopStatus = tradeStatusContainer.querySelector('.desktop-only .status-text');
    const mobileStatus = tradeStatusContainer.querySelector('.mobile-only .status-text');
    
    if (desktopStatus) {
      desktopStatus.className = `status-text text-xs px-2 py-1 rounded font-medium whitespace-nowrap ${uiData.status_class}`;
      desktopStatus.textContent = uiData.status_text;
    }
    
    if (mobileStatus) {
      mobileStatus.className = `status-text text-xs px-2 py-1 rounded font-medium whitespace-nowrap ${uiData.status_class}`;
      mobileStatus.textContent = uiData.status_text;
    }
    
    // 거래완료 버튼 숨기기
    if (uiData.hide_complete_button) {
      const completeButtons = document.querySelectorAll('#completeTradeBtn, #mobileCompleteTradeBtn');
      completeButtons.forEach(btn => {
        if (btn) btn.style.display = 'none';
      });
    }
  }
  
  // 완전히 완료된 경우 입력창도 비활성화
  if (isFullyCompleted) {
    const messageInputArea = document.getElementById('messageInputArea');
    if (messageInputArea) {
      messageInputArea.innerHTML = `
        <div class="text-center text-sm text-gray-500 py-4 flex items-center justify-center gap-2">
          <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          거래가 완료되어 더 이상 채팅을 보낼 수 없습니다.
        </div>`;
    }
    
    // 전역 상태 업데이트
    window.isTradeCompleted = true;
  }
}

// 헤더 메뉴 설정
export function setupHeaderMenu() {
  const headerMenuBtn = document.getElementById('headerMenuBtn');
  const headerDropdownMenu = document.getElementById('headerDropdownMenu');
  const viewUserInfoBtn = document.getElementById('viewUserInfoBtn');

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