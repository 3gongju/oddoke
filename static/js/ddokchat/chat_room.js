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

// ✅ 개선된 이미지 라이트박스 설정 함수 (확대/축소 기능 포함)
function setupImageLightbox() {
  const lightbox = document.getElementById('imageLightbox');
  const lightboxImage = document.getElementById('lightboxImage');
  const closeLightboxBtn = document.getElementById('closeLightbox');
  const lightboxInfo = document.getElementById('lightboxInfo');
  const lightboxLoading = document.getElementById('lightboxLoading');
  const zoomControls = document.getElementById('zoomControls');

  let currentScale = 1;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let translateX = 0;
  let translateY = 0;

  // ✅ 촬영시간 포맷팅 함수
  function formatTakenDateTime(takenDatetime) {
    if (!takenDatetime) return null;
    
    try {
      const date = new Date(takenDatetime);
      if (isNaN(date.getTime())) return null;
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}.${month}.${day} ${hours}:${minutes}`;
    } catch (error) {
      console.error('날짜 포맷팅 오류:', error);
      return null;
    }
  }

  // ✅ 확대/축소 적용 함수
  function applyTransform() {
    if (lightboxImage) {
      lightboxImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`;
      lightboxImage.style.cursor = currentScale > 1 ? 'grab' : 'default';
      
      // 줌 컨트롤 아이콘 업데이트
      updateZoomIcon();
    }
  }

  // ✅ 줌 아이콘 업데이트
  function updateZoomIcon() {
    const zoomIcon = document.getElementById('zoomIcon');
    if (zoomIcon) {
      if (currentScale > 1) {
        // 축소 아이콘
        zoomIcon.innerHTML = `
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM13.5 10.5h-6" />
        `;
      } else {
        // 확대 아이콘
        zoomIcon.innerHTML = `
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" />
        `;
      }
    }
  }

  // ✅ 줌 레벨 조정
  function setZoom(scale, centerX = 0, centerY = 0) {
    const prevScale = currentScale;
    currentScale = Math.min(Math.max(scale, 0.5), 3); // 0.5x ~ 3x 제한
    
    // 줌 중심점 조정
    if (prevScale !== currentScale) {
      const scaleChange = currentScale / prevScale;
      translateX = centerX + (translateX - centerX) * scaleChange;
      translateY = centerY + (translateY - centerY) * scaleChange;
    }
    
    applyTransform();
  }

  // ✅ 위치 리셋
  function resetPosition() {
    currentScale = 1;
    translateX = 0;
    translateY = 0;
    applyTransform();
  }

  // ✅ 라이트박스 열기 함수
  function openLightbox(imageSrc, imageAlt = '', takenDatetime = null) {
    if (lightbox && lightboxImage) {
      // 상태 초기화
      resetPosition();
      
      // 로딩 표시
      if (lightboxLoading) {
        lightboxLoading.classList.remove('hidden');
      }
      
      lightboxImage.style.opacity = '0';
      lightboxImage.src = imageSrc;
      lightboxImage.alt = imageAlt;
      
      // 라이트박스 하단 정보 설정
      if (lightboxInfo) {
        const formattedDate = formatTakenDateTime(takenDatetime);
        if (formattedDate) {
          lightboxInfo.innerHTML = `
            <div class="flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
                <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
                <path fill-rule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clip-rule="evenodd" />
              </svg>
              <span>${formattedDate} 촬영</span>
            </div>
          `;
          lightboxInfo.classList.remove('hidden');
        } else {
          lightboxInfo.classList.add('hidden');
        }
      }
      
      // 줌 컨트롤 표시 (데스크탑에서만)
      if (zoomControls && window.innerWidth >= 768) {
        zoomControls.classList.remove('hidden');
      }
      
      lightbox.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      
      // 이미지 로드 완료 시
      lightboxImage.onload = function() {
        this.style.opacity = '1';
        if (lightboxLoading) {
          lightboxLoading.classList.add('hidden');
        }
        updateZoomIcon();
      };
    }
  }

  // ✅ 라이트박스 닫기 함수
  function closeLightbox() {
    if (lightbox) {
      lightbox.classList.add('hidden');
      document.body.style.overflow = '';
      
      if (lightboxImage) {
        lightboxImage.src = '';
      }
      
      if (lightboxInfo) {
        lightboxInfo.innerHTML = '';
        lightboxInfo.classList.add('hidden');
      }
      
      if (zoomControls) {
        zoomControls.classList.add('hidden');
      }
      
      resetPosition();
    }
  }

  // ✅ 이벤트 리스너 설정

  // 닫기 버튼
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

  // ✅ 데스크탑 전용 이벤트 (마우스 휠, 클릭)
  if (lightboxImage) {
    // 마우스 휠 줌
    lightboxImage.addEventListener('wheel', function(e) {
      if (window.innerWidth >= 768) { // 데스크탑에서만
        e.preventDefault();
        const rect = this.getBoundingClientRect();
        const centerX = e.clientX - rect.left - rect.width / 2;
        const centerY = e.clientY - rect.top - rect.height / 2;
        
        const zoomFactor = e.deltaY < 0 ? 1.2 : 0.8;
        setZoom(currentScale * zoomFactor, centerX, centerY);
      }
    });

    // 더블클릭으로 줌 토글
    lightboxImage.addEventListener('dblclick', function(e) {
      if (window.innerWidth >= 768) { // 데스크탑에서만
        e.preventDefault();
        if (currentScale > 1) {
          resetPosition();
        } else {
          const rect = this.getBoundingClientRect();
          const centerX = e.clientX - rect.left - rect.width / 2;
          const centerY = e.clientY - rect.top - rect.height / 2;
          setZoom(2, centerX, centerY);
        }
      }
    });

    // 드래그 기능 (확대된 상태에서)
    lightboxImage.addEventListener('mousedown', function(e) {
      if (currentScale > 1 && window.innerWidth >= 768) {
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        this.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });

    document.addEventListener('mousemove', function(e) {
      if (isDragging && currentScale > 1) {
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        applyTransform();
      }
    });

    document.addEventListener('mouseup', function() {
      if (isDragging) {
        isDragging = false;
        if (lightboxImage) {
          lightboxImage.style.cursor = currentScale > 1 ? 'grab' : 'default';
        }
      }
    });

    // ✅ 모바일 터치 이벤트 (핀치 줌)
    let initialDistance = 0;
    let initialScale = 1;

    lightboxImage.addEventListener('touchstart', function(e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        initialDistance = getDistance(e.touches[0], e.touches[1]);
        initialScale = currentScale;
      } else if (e.touches.length === 1 && currentScale > 1) {
        isDragging = true;
        const touch = e.touches[0];
        startX = touch.clientX - translateX;
        startY = touch.clientY - translateY;
      }
    });

    lightboxImage.addEventListener('touchmove', function(e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scale = (currentDistance / initialDistance) * initialScale;
        setZoom(scale);
      } else if (e.touches.length === 1 && isDragging && currentScale > 1) {
        e.preventDefault();
        const touch = e.touches[0];
        translateX = touch.clientX - startX;
        translateY = touch.clientY - startY;
        applyTransform();
      }
    });

    lightboxImage.addEventListener('touchend', function(e) {
      if (e.touches.length === 0) {
        isDragging = false;
      }
    });

    // 터치 거리 계산 함수
    function getDistance(touch1, touch2) {
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
  }

  // ✅ 줌 컨트롤 버튼 이벤트
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const resetBtn = document.getElementById('resetBtn');

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', function() {
      setZoom(currentScale * 1.3);
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', function() {
      setZoom(currentScale * 0.7);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      resetPosition();
    });
  }

  // ✅ 이미지 클릭 이벤트 추가 함수
  function addImageClickEvents() {
    const chatImages = document.querySelectorAll('#chat-log img');
    chatImages.forEach(img => {
      if (!img.hasAttribute('data-lightbox-enabled')) {
        img.style.cursor = 'pointer';
        img.setAttribute('title', '클릭하여 확대');
        
        img.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          const takenDatetime = this.getAttribute('data-taken-datetime');
          openLightbox(this.src, this.alt || '채팅 이미지', takenDatetime);
        });
        
        // 호버 효과
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

  // 전역 함수로 노출
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

// ✅ 수정된 handleImageUpload 함수 (EXIF 데이터 추출 포함)
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

  // ✅ EXIF 데이터 추출 함수 호출
  extractExifData(file, function(exifData) {
    // FormData 생성
    const formData = new FormData();
    formData.append('image', file);
    formData.append('room_id', window.roomId);
    
    // ✅ EXIF 데이터가 있으면 추가
    if (exifData && exifData.taken_datetime) {
      formData.append('taken_datetime', exifData.taken_datetime);
    }

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
          message_id: data.message_id,
          taken_datetime: exifData ? exifData.taken_datetime : null // ✅ 추가
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
  });
}

// ✅ 새로 추가: EXIF 데이터 추출 함수
function extractExifData(file, callback) {
  // JPEG가 아닌 경우 EXIF 데이터 없음
  if (!file.type.includes('jpeg') && !file.type.includes('jpg')) {
    callback(null);
    return;
  }

  // 파일을 이미지 객체로 변환
  const img = new Image();
  const url = URL.createObjectURL(file);
  
  img.onload = function() {
    // EXIF 데이터 추출
    EXIF.getData(img, function() {
      try {
        // DateTimeOriginal 추출 (실제 촬영시간)
        const dateTimeOriginal = EXIF.getTag(this, "DateTimeOriginal");
        
        let takenDatetime = null;
        
        if (dateTimeOriginal) {
          // EXIF 날짜 형식: "2024:06:19 14:30:25"
          // JavaScript Date 형식으로 변환: "2024-06-19T14:30:25"
          const formattedDate = dateTimeOriginal.replace(/:/g, '-').replace(' ', 'T');
          const date = new Date(formattedDate);
          
          // 유효한 날짜인지 확인
          if (!isNaN(date.getTime())) {
            // ISO 8601 형식으로 변환 (서버에서 파싱하기 쉽게)
            takenDatetime = date.toISOString();
          }
        }
        
        // URL 해제 (메모리 절약)
        URL.revokeObjectURL(url);
        
        // 콜백 호출
        callback({
          taken_datetime: takenDatetime
        });
        
        console.log('EXIF 추출 완료:', { taken_datetime: takenDatetime });
        
      } catch (error) {
        console.error('EXIF 데이터 추출 오류:', error);
        URL.revokeObjectURL(url);
        callback(null);
      }
    });
  };
  
  img.onerror = function() {
    console.error('이미지 로딩 실패');
    URL.revokeObjectURL(url);
    callback(null);
  };
  
  img.src = url;
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