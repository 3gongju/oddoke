// static/js/ddokchat/chat_room.js

import { setupWebSocket, registerMessageHandler, sendMessage } from './websocket_manager.js';
import { 
  setupMessageHandlers, 
  handleTextMessage, 
  handleImageMessage, 
  handleAccountMessage, 
  handleAddressMessage,
  handleReadUpdate,
  handleReadMessageSyncFinish,
  handleEnterChatroomFinish,
  handleTradeCompleted
} from './message_handler.js';
import { 
  setupUIManager, 
  showToast, 
  showLoadingToast, 
  hideLoadingToast, 
  checkTradeCompletedBeforeSend 
} from './ui_manager.js';
import { setupFraudCheck } from './fraud_check.js';

document.addEventListener("DOMContentLoaded", () => {
  // 전역 변수에서 데이터 가져오기
  const roomId = window.roomId;
  const currentUser = window.currentUser;
  const currentUserId = window.currentUserId;
  const isTradeCompleted = window.isTradeCompleted;

  // 각 모듈 초기화
  setupUIManager(isTradeCompleted);
  setupMessageHandlers(currentUser, currentUserId);
  setupFraudCheck();
  
  // WebSocket 메시지 핸들러 등록
  registerMessageHandler('showToast', showToast); // UI 업데이트용
  registerMessageHandler('chat_message', handleTextMessage);
  registerMessageHandler('chat_image', handleImageMessage);
  registerMessageHandler('account_info', handleAccountMessage);
  registerMessageHandler('address_info', handleAddressMessage);
  registerMessageHandler('read_update', handleReadUpdate);
  registerMessageHandler('read_message_sync_finish', handleReadMessageSyncFinish);
  registerMessageHandler('enter_chatroom_finish', handleEnterChatroomFinish);
  registerMessageHandler('trade_completed', handleTradeCompleted);
  
  // WebSocket 연결
  setupWebSocket(roomId);
  
  // 전역 함수로 노출 (다른 스크립트나 인라인에서 사용)
  window.sendWebSocketMessage = sendMessage;
  
  // 이벤트 리스너 설정
  setupEventListeners();
});

function setupEventListeners() {
  const input = document.getElementById('chat-message-input');
  const submit = document.getElementById('chat-message-submit');
  const imageUpload = document.getElementById('chat-image-upload');
  
  // 메시지 전송
  if (submit) {
    submit.onclick = sendTextMessage;
  }

  // 엔터키 전송
  if (input) {
    input.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        sendTextMessage();
      }
    });
    
    // 입력창 포커스
    input.focus();
  }

  // 이미지 업로드
  if (imageUpload) {
    imageUpload.addEventListener('change', handleImageUpload);
  }

  // + 버튼 메뉴 설정
  setupPlusMenu();
  
  // 거래 완료 모달 설정
  setupTradeCompleteModal();
}

function sendTextMessage() {
  if (!checkTradeCompletedBeforeSend()) return;

  const input = document.getElementById('chat-message-input');
  const message = input.value.trim();
  
  if (message) {
    sendMessage({ 
      'room_id': window.roomId,
      'message': message
    });
    input.value = '';
  }
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  if (!checkTradeCompletedBeforeSend()) {
    this.value = '';
    return;
  }

  // 파일 크기 체크 (10MB 제한)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    showToast('파일 크기가 10MB를 초과합니다.', 'error');
    this.value = '';
    return;
  }

  // 파일 타입 체크
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    showToast('지원하지 않는 파일 형식입니다. (JPEG, PNG, GIF, WebP만 가능)', 'error');
    this.value = '';
    return;
  }

  const loadingToast = showLoadingToast('이미지 업로드 중...');

  const formData = new FormData();
  formData.append('image', file);
  formData.append('room_id', window.roomId);

  const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';

  fetch("/ddokchat/upload_image/", {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken,
    },
    body: formData,
  })
  .then(response => response.json())
  .then(data => {
    hideLoadingToast(loadingToast);
    
    if (data.success) {
      sendMessage({
        type: 'chat_image',
        room_id: window.roomId,
        image_url: data.image_url,
        sender_id: window.currentUserId
      });
      showToast('이미지가 전송되었습니다.', 'success');
    } else {
      showToast('이미지 업로드 실패: ' + (data.error || ''), 'error');
    }
  })
  .catch(error => {
    hideLoadingToast(loadingToast);
    console.error('이미지 업로드 오류:', error);
    showToast('이미지 업로드 중 오류가 발생했습니다.', 'error');
  })
  .finally(() => {
    e.target.value = '';
  });
}

function setupPlusMenu() {
  const plusMenuBtn = document.getElementById('plus-menu-btn');
  const plusMenu = document.getElementById('plus-menu');
  const sendAccountBtn = document.getElementById('send-account-btn');
  const sendAddressBtn = document.getElementById('send-address-btn');

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

function sendAccountInfo() {
  if (!checkTradeCompletedBeforeSend()) return;

  const loadingToast = showLoadingToast('계좌정보 전송 중...');
  const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';

  fetch(`/ddokchat/send-account/${window.roomId}/`, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken,
      'Content-Type': 'application/json',
    },
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
      sendMessage({
        type: 'account_info',
        room_id: window.roomId,
        account_info: data.account_info,
        sender_id: window.currentUserId,
        message_id: data.message_id
      });
      showToast('계좌정보가 전송되었습니다.', 'success');
    } else {
      if (data.redirect_to_mypage) {
        if (confirm('계좌 정보를 먼저 등록해주세요. 마이페이지로 이동하시겠습니까?')) {
          window.location.href = '/accounts/mypage/';
        }
      } else {
        showToast(data.error || '계좌정보 전송에 실패했습니다.', 'error');
      }
    }
  })
  .catch(error => {
    hideLoadingToast(loadingToast);
    console.error('Fetch 오류:', error);
    showToast('계좌정보 전송 중 오류가 발생했습니다.', 'error');
  });
}

function sendAddressInfo() {
  if (!checkTradeCompletedBeforeSend()) return;

  const loadingToast = showLoadingToast('주소정보 전송 중...');
  const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';

  fetch(`/ddokchat/send-address/${window.roomId}/`, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken,
      'Content-Type': 'application/json',
    },
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
      sendMessage({
        type: 'address_info',
        room_id: window.roomId,
        address_info: data.address_info,
        sender_id: window.currentUserId,
        message_id: data.message_id
      });
      showToast('주소정보가 전송되었습니다.', 'success');
    } else {
      if (data.redirect_to_mypage) {
        if (confirm('주소 정보를 먼저 등록해주세요. 마이페이지로 이동하시겠습니까?')) {
          window.location.href = '/accounts/mypage/';
        }
      } else {
        showToast(data.error || '주소정보 전송에 실패했습니다.', 'error');
      }
    }
  })
  .catch(error => {
    hideLoadingToast(loadingToast);
    console.error('Fetch 오류:', error);
    showToast('주소정보 전송 중 오류가 발생했습니다.', 'error');
  });
}

function setupTradeCompleteModal() {
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
      
      const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
      
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
          // UI 업데이트는 message_handler에서 처리
          import('./ui_manager.js').then(({ updateUIAfterTradeComplete }) => {
            updateUIAfterTradeComplete(data.is_fully_completed);
          });
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

// 리뷰 모달 관련 처리
function setupReviewModal() {
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

// 페이지 로드 완료 후 리뷰 모달 체크
setTimeout(() => {
  setupReviewModal();
}, 500);