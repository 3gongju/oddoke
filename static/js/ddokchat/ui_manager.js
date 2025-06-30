// static/js/ddokchat/ui_manager.js

const chatLog = document.getElementById('chat-log');
let isTradeCompleted = false;

export function setupUIManager(tradeCompletedStatus) {
  isTradeCompleted = tradeCompletedStatus;
  setupInitialObservers();
  
  // ✅ scrollToBottom를 전역으로 노출 (auto_detect에서 사용)
  window.scrollToBottom = scrollToBottom;
  window.showToast = showToast;
  window.showLoadingToast = showLoadingToast;
  window.hideLoadingToast = hideLoadingToast;
  
  if (chatLog) {
    // 1. 숨긴 상태에서 스크롤 위치 먼저 설정
    chatLog.style.scrollBehavior = 'auto';
    chatLog.scrollTop = chatLog.scrollHeight;
    
    // 2. 잠깐 후 페이드인으로 표시 (자연스러움)
    setTimeout(() => {
      chatLog.classList.add('ready');
      
      // 3. 페이드인 완료 후 부드러운 스크롤 활성화
      setTimeout(() => {
        chatLog.style.scrollBehavior = 'smooth';
      }, 200);
    }, 50);
  }
  
  // 입력/버튼 비활성화 (거래 완료 시)
  if (isTradeCompleted) {
    const input = document.getElementById('chat-message-input');
    const submit = document.getElementById('chat-message-submit');
    if (input) input.disabled = true;
    if (submit) submit.disabled = true;
  }
}

export function scrollToBottom(instant = false) {
  if (chatLog) {
    if (instant) {
      // 즉시 이동 (애니메이션 없음)
      chatLog.scrollTop = chatLog.scrollHeight;
    } else {
      // 부드러운 애니메이션
      chatLog.scrollTo({
        top: chatLog.scrollHeight,
        behavior: 'smooth'
      });
    }
  }
}

export function scrollToBottomAfterImageLoad(imgElement) {
  if (imgElement && imgElement.complete) {
    // 이미 로딩 완료된 경우 - 부드럽게 스크롤
    scrollToBottom(false);
  } else if (imgElement) {
    // 로딩 중인 경우 - 로딩 완료 시 부드럽게 스크롤
    imgElement.onload = function() {
      scrollToBottom(false);
    };
    imgElement.onerror = function() {
      scrollToBottom(false);
    };
    // 타임아웃 방어 로직
    setTimeout(() => {
      scrollToBottom(false);
    }, 1000);
  } else {
    // 이미지 요소가 없는 경우 부드럽게 스크롤
    scrollToBottom(false);
  }
}

export function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const bgColor = type === 'error' ? 'bg-red-600' : 
                  type === 'success' ? 'bg-green-600' : 
                  type === 'loading' ? 'bg-blue-600' : 'bg-gray-800';
  
  toast.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300`;
  toast.style.transform = 'translateX(100%)';
  toast.style.opacity = '0';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // 진입 애니메이션
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  }, 10);
  
  // 자동 제거
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

export function showLoadingToast(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2';
  toast.style.transform = 'translateX(100%)';
  toast.style.opacity = '0';
  toast.innerHTML = `
    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  
  // 진입 애니메이션
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  }, 10);
  
  return toast;
}

export function hideLoadingToast(toast) {
  if (toast && toast.parentNode) {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 300);
  }
}

export function checkTradeCompletedBeforeSend() {
  if (isTradeCompleted) {
    showToast("거래가 완료되어 더 이상 메시지를 보낼 수 없습니다.", 'error');
    return false;
  }
  return true;
}

export function addMessageAnimation(messageContainer) {
  // 메시지 등장 애니메이션 적용
  messageContainer.style.opacity = '0';
  messageContainer.style.transform = 'translateY(20px)';
  
  setTimeout(() => {
    messageContainer.style.transition = 'all 0.3s ease-out';
    messageContainer.style.opacity = '1';
    messageContainer.style.transform = 'translateY(0)';
  }, 10);
}

// static/js/ddokchat/message_handler.js의 updateUIAfterTradeCancel 함수 수정

function updateUIAfterTradeCancel() {
  const tradeStatusContainer = document.getElementById('tradeStatusContainer');
  const messageInputArea = document.getElementById('messageInputArea');

  if (tradeStatusContainer) {
    // 모든 버튼을 취소 상태로 변경
    tradeStatusContainer.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="status-text cancelled text-xs px-2 py-1 rounded font-medium">거래 취소됨</span>
      </div>
    `;
  }

  if (messageInputArea) {
    messageInputArea.innerHTML = `
      <div class="text-center text-sm text-gray-500 py-4 flex items-center justify-center gap-2">
        <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        거래가 취소되어 더 이상 채팅을 보낼 수 없습니다.
      </div>
    `;
  }
  
  // 전역 상태 업데이트
  window.isTradeCompleted = true; // 취소도 완료 상태로 간주
}

// static/js/ddokchat/ui_manager.js의 updateUIAfterTradeComplete 함수 수정

export function updateUIAfterTradeComplete(isFullyCompleted) {
  const tradeStatusContainer = document.getElementById('tradeStatusContainer');
  const messageInputArea = document.getElementById('messageInputArea');

  if (isFullyCompleted) {
    if (tradeStatusContainer) {
      tradeStatusContainer.innerHTML = '<span class="text-xs text-red-500 font-semibold">거래 완료된 채팅</span>';
    }
    if (messageInputArea) {
      messageInputArea.innerHTML = `
        <div class="text-center text-sm text-gray-500 py-4 flex items-center justify-center gap-2">
          <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          거래가 완료되어 더 이상 채팅을 보낼 수 없습니다.
        </div>`;
    }
    isTradeCompleted = true;
    showToast('거래가 완료되었습니다!', 'success');
  } else {
    if (tradeStatusContainer) {
      tradeStatusContainer.innerHTML = '<span class="text-xs text-red-700 font-medium">상대방의 거래 완료를 기다리는 중입니다.</span>';
    }
  }
}

export function updateSensitiveInfoCards() {
  console.log('민감한 정보 카드 업데이트 시작');
  
  document.querySelectorAll('#chat-log .flex').forEach(messageContainer => {
    const bankCard = messageContainer.querySelector('.space-y-3');
    if (bankCard && bankCard.innerHTML.includes('💳')) {
      console.log('계좌 카드 발견, 업데이트 중...');
      
      const isMyMessage = messageContainer.classList.contains('justify-end');
      
      if (isMyMessage) {
        bankCard.innerHTML = `
          <div class="bg-gray-800 rounded-lg p-4 text-center">
            <p class="text-sm text-gray-300 font-medium">거래 완료로 계좌정보가 삭제되었습니다</p>
            <p class="text-xs text-gray-400 mt-1">개인정보 보호를 위해 자동으로 삭제되었습니다</p>
          </div>
        `;
      } else {
        bankCard.innerHTML = `
          <div class="bg-gray-100 rounded-lg p-4 text-center">
            <p class="text-sm text-gray-600 font-medium">거래 완료로 계좌정보가 삭제되었습니다</p>
            <p class="text-xs text-gray-500 mt-1">개인정보 보호를 위해 자동으로 삭제되었습니다</p>
          </div>
        `;
      }
      console.log('계좌 카드 업데이트 완료');
    }
    
    if (bankCard && bankCard.innerHTML.includes('📍')) {
      console.log('주소 카드 발견, 업데이트 중...');
      
      const isMyMessage = messageContainer.classList.contains('justify-end');
      
      if (isMyMessage) {
        bankCard.innerHTML = `
          <div class="bg-gray-800 rounded-lg p-4 text-center">
            <p class="text-sm text-gray-300 font-medium">거래 완료로 주소정보가 삭제되었습니다</p>
            <p class="text-xs text-gray-400 mt-1">개인정보 보호를 위해 자동으로 삭제되었습니다</p>
          </div>
        `;
      } else {
        bankCard.innerHTML = `
          <div class="bg-gray-100 rounded-lg p-4 text-center">
            <p class="text-sm text-gray-600 font-medium">거래 완료로 주소정보가 삭제되었습니다</p>
            <p class="text-xs text-gray-500 mt-1">개인정보 보호를 위해 자동으로 삭제되었습니다</p>
          </div>
        `;
      }
      console.log('주소 카드 업데이트 완료');
    }
  });
  
  console.log('모든 민감한 정보 카드 업데이트 완료');
}

// 스크롤 동작 제어 함수들 (추가 옵션)
export function enableSmoothScroll() {
  if (chatLog) {
    chatLog.style.scrollBehavior = 'smooth';
  }
}

export function disableSmoothScroll() {
  if (chatLog) {
    chatLog.style.scrollBehavior = 'auto';
  }
}

// IntersectionObserver 설정
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const isVisible = entry.isIntersecting;
    const senderFromDataset = entry.target.dataset.sender;
    const currentUser = window.currentUser || '';
    const isMine = senderFromDataset === currentUser;
    
    if (isVisible && !isMine) {
      // WebSocket을 통해 읽음 처리
      if (window.sendWebSocketMessage) {
        window.sendWebSocketMessage({
          type: 'read_message_sync',
          room_code: window.roomCode
        });
      }
      observer.unobserve(entry.target);
    }
  });
}, {
  threshold: 1.0
});

export function registerObserver(messageContainer, senderName) {
  const timeElement = messageContainer.querySelector('.text-xs');
  const currentUser = window.currentUser || '';
  
  if (timeElement && senderName !== currentUser) {
    timeElement.dataset.sender = senderName;
    observer.observe(timeElement);
  }
}

function setupInitialObservers() {
  const messageContainers = document.querySelectorAll('#chat-log .flex');
  const currentUser = window.currentUser || '';
  
  messageContainers.forEach(container => {
    const timeElements = container.querySelectorAll('.text-xs.text-gray-400');
    
    timeElements.forEach(timeElement => {
      const isMyMessage = container.classList.contains('justify-end');
      
      if (!isMyMessage) {
        const messageDiv = container.querySelector('.max-w-xs');
        if (messageDiv) {
          const nicknameElement = messageDiv.querySelector('.text-sm.font-semibold.text-gray-800');
          if (nicknameElement) {
            const senderName = nicknameElement.textContent.trim();
            timeElement.dataset.sender = senderName;
            observer.observe(timeElement);
          }
        }
      }
    });
  });
  
  console.log('초기 메시지 Observer 설정 완료');
}