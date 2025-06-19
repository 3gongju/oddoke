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
import { setupAutoDetect } from './auto_detect.js';

// CSRF 토큰 가져오는 함수
function getCSRFToken() {
  // 1순위: 전역변수에서 가져오기
  if (window.csrfToken) {
    return window.csrfToken;
  }
  
  // 2순위: 메타태그에서 가져오기
  const metaToken = document.querySelector('meta[name="csrf-token"]');
  if (metaToken && metaToken.content) {
    return metaToken.content;
  }
  
  // 3순위: 쿠키에서 가져오기
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrftoken' && value) {
      return decodeURIComponent(value);
    }
  }
  
  // 4순위: hidden input에서 가져오기
  const hiddenInput = document.querySelector('[name=csrfmiddlewaretoken]');
  if (hiddenInput && hiddenInput.value) {
    return hiddenInput.value;
  }
  
  console.error('CSRF 토큰을 찾을 수 없습니다!');
  return null;
}

// CSRF 토큰 가져오는 함수
function getCSRFToken() {
  // 1순위: 전역변수에서 가져오기
  if (window.csrfToken) {
    return window.csrfToken;
  }
  
  // 2순위: 메타태그에서 가져오기
  const metaToken = document.querySelector('meta[name="csrf-token"]');
  if (metaToken && metaToken.content) {
    return metaToken.content;
  }
  
  // 3순위: 쿠키에서 가져오기
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrftoken' && value) {
      return decodeURIComponent(value);
    }
  }
  
  // 4순위: hidden input에서 가져오기
  const hiddenInput = document.querySelector('[name=csrfmiddlewaretoken]');
  if (hiddenInput && hiddenInput.value) {
    return hiddenInput.value;
  }
  
  console.error('CSRF 토큰을 찾을 수 없습니다!');
  return null;
}

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
  setupAutoDetect();
  
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

  // 플러스 메뉴 설정 (이미지 업로드 포함)
  setupPlusMenu();
  
  // 거래 완료 모달 설정
  setupTradeCompleteModal();
  
  // 헤더 메뉴 설정
  setupHeaderMenu();
  
  // ✅ 이미지 라이트박스 설정 추가
  setupImageLightbox();
}

// ✅ 새로 추가: 이미지 라이트박스 설정 함수
function setupImageLightbox() {
  const lightbox = document.getElementById('imageLightbox');
  const lightboxImage = document.getElementById('lightboxImage');
  const closeLightboxBtn = document.getElementById('closeLightbox');
  const lightboxInfo = document.getElementById('lightboxInfo');
  const lightboxLoading = document.getElementById('lightboxLoading');

  // 라이트박스 열기 함수
  function openLightbox(imageSrc, imageAlt = '') {
    if (lightbox && lightboxImage) {
      // 로딩 표시
      if (lightboxLoading) {
        lightboxLoading.classList.remove('hidden');
      }
      
      lightboxImage.style.opacity = '0';
      lightboxImage.src = imageSrc;
      lightboxImage.alt = imageAlt;
      
      if (lightboxInfo) {
        lightboxInfo.textContent = imageAlt || '이미지를 확대해서 보고 있습니다';
      }
      
      lightbox.classList.remove('hidden');
      
      // 바디 스크롤 방지
      document.body.style.overflow = 'hidden';
      
      // 이미지 로드 완료 시
      lightboxImage.onload = function() {
        lightboxImage.style.opacity = '1';
        if (lightboxLoading) {
          lightboxLoading.classList.add('hidden');
        }
      };
    }
  }

  // 라이트박스 닫기 함수
  function closeLightbox() {
    if (lightbox) {
      lightbox.classList.add('hidden');
      
      // 바디 스크롤 복원
      document.body.style.overflow = '';
      
      // 이미지 소스 초기화 (메모리 절약)
      if (lightboxImage) {
        lightboxImage.src = '';
      }
    }
  }

  // 닫기 버튼 이벤트
  if (closeLightboxBtn) {
    closeLightboxBtn.addEventListener('click', closeLightbox);
  }

  // 배경 클릭으로 닫기
  if (lightbox) {
    lightbox.addEventListener('click', function(e) {
      if (e.target === lightbox) {
        closeLightbox();
      }
    });
  }

  // ESC 키로 닫기
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && lightbox && !lightbox.classList.contains('hidden')) {
      closeLightbox();
    }
  });

  // 채팅 이미지들에 클릭 이벤트 추가
  function addImageClickEvents() {
    const chatImages = document.querySelectorAll('#chat-log img');
    chatImages.forEach(img => {
      if (!img.hasAttribute('data-lightbox-enabled')) {
        img.style.cursor = 'pointer';
        img.setAttribute('title', '클릭하여 확대');
        
        img.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          openLightbox(this.src, this.alt || '채팅 이미지');
        });
        
        // 호버 효과 추가
        img.addEventListener('mouseenter', function() {
          this.style.transform = 'scale(1.02)';
          this.style.transition = 'transform 0.2s ease';
        });
        
        img.addEventListener('mouseleave', function() {
          this.style.transform = 'scale(1)';
        });
        
        img.setAttribute('data-lightbox-enabled', 'true');
      }
    });
  }

  // 초기 이미지들에 이벤트 추가
  addImageClickEvents();

  // MutationObserver로 새로 추가되는 이미지들 감지
  const chatLog = document.getElementById('chat-log');
  if (chatLog) {
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // 약간의 지연을 두고 이벤트 추가 (DOM이 완전히 렌더링된 후)
          setTimeout(() => {
            addImageClickEvents();
          }, 100);
        }
      });
    });

    observer.observe(chatLog, {
      childList: true,
      subtree: true
    });
  }

  // 전역 함수로 노출 (필요시)
  window.openImageLightbox = openLightbox;
  window.closeImageLightbox = closeLightbox;
}

// 헤더 메뉴 설정 함수
function setupHeaderMenu() {
  const headerMenuBtn = document.getElementById('headerMenuBtn');
  const headerDropdownMenu = document.getElementById('headerDropdownMenu');
  const viewUserInfoBtn = document.getElementById('viewUserInfoBtn');
  const reportUserBtn = document.getElementById('reportUserBtn');

  if (headerMenuBtn && headerDropdownMenu) {
    // 메뉴 버튼 클릭 시 드롭다운 토글
    headerMenuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      headerDropdownMenu.classList.toggle('hidden');
    });

    // 외부 클릭 시 드롭다운 닫기
    document.addEventListener('click', function(e) {
      if (!headerDropdownMenu.contains(e.target) && !headerMenuBtn.contains(e.target)) {
        headerDropdownMenu.classList.add('hidden');
      }
    });

    // 드롭다운 내부 클릭 시 이벤트 전파 방지
    headerDropdownMenu.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  }

  // 거래자 정보 보기 클릭
  if (viewUserInfoBtn) {
    viewUserInfoBtn.addEventListener('click', function() {
      headerDropdownMenu.classList.add('hidden');
      showUserInfo();
    });
  }

  // 신고하기 클릭
  if (reportUserBtn) {
    reportUserBtn.addEventListener('click', function() {
      headerDropdownMenu.classList.add('hidden');
      showReportModal();
    });
  }
}

// 거래자 정보 보기 함수
function showUserInfo() {
  // 현재 채팅방의 상대방 정보 가져오기
  const otherUser = getOtherUserUsername();
  
  if (otherUser) {
    // 사용자 프로필 페이지로 이동
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
  
  // 신고 확인 모달
  if (confirm(`'${otherUser}' 사용자를 신고하시겠습니까?\n\n신고 사유:\n• 사기/허위 거래\n• 욕설/비방\n• 불법 상품 거래\n• 기타 부적절한 행위\n\n신고 후 관리자가 검토합니다.`)) {
    // 신고 처리
    handleUserReport(otherUser);
  }
}

// 상대방 사용자명 가져오기 함수
function getOtherUserUsername() {
  // 헤더에서 상대방 사용자명 추출
  const userNameElement = document.querySelector('.bg-gray-50 h2.font-semibold');
  if (userNameElement) {
    return userNameElement.textContent.trim();
  }
  
  // 또는 전역 변수에서 가져오기 (있다면)
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

  // 신고 API 호출 (실제 API 엔드포인트에 맞게 수정 필요)
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
    
    // API가 구현되지 않은 경우 대체 처리
    if (error.message.includes('404') || error.message.includes('405')) {
      showToast('신고 기능이 준비 중입니다. 고객센터로 문의해주세요.', 'info');
    } else {
      showToast('신고 처리 중 오류가 발생했습니다.', 'error');
    }
  });
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

function handleImageUpload(file) {
  if (!file) return;
  
  if (!checkTradeCompletedBeforeSend()) {
    return;
  }

  // 파일 크기 체크 (10MB 제한)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    showToast('파일 크기가 10MB를 초과합니다.', 'error');
    return;
  }

  // 파일 타입 체크
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    showToast('지원하지 않는 파일 형식입니다. (JPEG, PNG, GIF, WebP만 가능)', 'error');
    return;
  }

  const loadingToast = showLoadingToast('이미지 업로드 중...');

  const formData = new FormData();
  formData.append('image', file);
  formData.append('room_id', window.roomId);

  // CSRF 토큰 가져오기
  const csrfToken = getCSRFToken();
  if (!csrfToken) {
    hideLoadingToast(loadingToast);
    showToast('보안 토큰 오류입니다. 페이지를 새로고침해주세요.', 'error');
    return;
  }

  fetch("/ddokchat/upload_image/", {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken,
      // FormData 사용시 Content-Type은 설정하지 않음!
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
        sender_id: window.currentUserId,
        message_id: data.message_id
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
  });
}

function setupPlusMenu() {
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

  // 이미지/동영상 버튼
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
        e.target.value = ''; // 선택 초기화
      }
    });
  }

  // 계좌 공유 버튼
  if (sendAccountBtn) {
    sendAccountBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (plusMenu) plusMenu.classList.add('hidden');
      sendAccountInfo();
    });
  }

  // 주소 공유 버튼
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
  
  // CSRF 토큰 가져오기
  const csrfToken = getCSRFToken();
  if (!csrfToken) {
    hideLoadingToast(loadingToast);
    showToast('보안 토큰 오류입니다. 페이지를 새로고침해주세요.', 'error');
    return;
  }

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
  
  // CSRF 토큰 가져오기
  const csrfToken = getCSRFToken();
  if (!csrfToken) {
    hideLoadingToast(loadingToast);
    showToast('보안 토큰 오류입니다. 페이지를 새로고침해주세요.', 'error');
    return;
  }

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
      
      // CSRF 토큰 가져오기
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