// static/js/ddokchat/auto_detect.js

import { showToast } from './ui_manager.js';

export function setupAutoDetect() {
  // 전역 함수로 노출
  window.quickFraudCheck = quickFraudCheck;
  window.dismissAccountAlert = dismissAccountAlert;
  
  // ✅ 페이지 로드 후 기존 메시지들 스캔
  setTimeout(() => {
    scanExistingMessages();
  }, 2000); // DOM이 완전히 로드된 후 실행
}

// 계좌번호 패턴 감지 함수
export function detectAccountNumber(message) {
  if (!message || typeof message !== 'string') return null;
  
  // 010으로 시작하는 전화번호 제외
  if (message.includes('010')) return null;
  
  const patterns = [
    /\b(?!010)\d{10,14}\b/g,                    // 010이 아닌 10-14자리 연속 숫자
    /\b(?!010-)\d{3,6}-\d{2,6}-\d{6,8}\b/g,    // 하이픈 구분 (010- 제외)
    /\b(?!010)\d{4}-\d{4}-\d{4,8}\b/g          // 4-4-4~ 패턴
  ];
  
  for (let pattern of patterns) {
    const matches = message.match(pattern);
    if (matches && matches.length > 0) {
      // 가장 긴 매치를 반환 (더 정확할 가능성)
      return matches.reduce((longest, current) => 
        current.length > longest.length ? current : longest
      );
    }
  }
  
  return null;
}

// 메시지 래퍼 하단에 계좌번호 감지 알림 추가
export function addAccountDetectionAlert(messageWrapper, detectedAccount) {
  // messageWrapper가 실제로 존재하는지 확인
  if (!messageWrapper) {
    return;
  }
  
  // 이미 알림이 있는지 체크
  if (messageWrapper.querySelector('.account-detection-alert')) {
    return;
  }
  
  const alertDiv = document.createElement('div');
  
  // ✅ 더 안전한 고정 크기 (모바일: xs, 데스크톱: sm)
  alertDiv.className = 'account-detection-alert mt-3 max-w-xs sm:max-w-sm ml-2 mr-2';
  alertDiv.innerHTML = `
    <div class="bg-orange-50 border border-orange-200 rounded-lg p-3 transition-all duration-300">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="flex items-start gap-2 flex-1 min-w-0">
          <svg class="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z"></path>
          </svg>
          <span class="text-sm text-orange-800 font-medium leading-relaxed">
            계좌번호가 감지되었습니다.<br>사기이력 조회를 할까요?
          </span>
        </div>
        <div class="flex items-center justify-end gap-2 flex-shrink-0">
          <button 
            onclick="quickFraudCheck('${detectedAccount}')" 
            class="text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            조회하기
          </button>
          <button 
            onclick="dismissAccountAlert(this)" 
            class="text-orange-400 hover:text-orange-600 transition-colors p-1"
            title="닫기"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
  
  // 메시지 래퍼 하단에 추가 (세로 배치되도록)
  try {
    messageWrapper.appendChild(alertDiv);
  } catch (error) {
    return;
  }
  
  // 등장 애니메이션
  alertDiv.style.opacity = '0';
  alertDiv.style.transform = 'translateY(-10px)';
  alertDiv.style.transition = 'all 0.3s ease-out';
  
  setTimeout(() => {
    alertDiv.style.opacity = '1';
    alertDiv.style.transform = 'translateY(0)';
    
    // ✅ 애니메이션 완료 후 부드럽게 스크롤
    setTimeout(() => {
      if (window.scrollToBottom) {
        window.scrollToBottom();
      } else {
        const chatLog = document.getElementById('chat-log');
        if (chatLog) {
          chatLog.scrollTo({
            top: chatLog.scrollHeight,
            behavior: 'smooth'
          });
        }
      }
    }, 200);
  }, 100);
}

// 빠른 사기조회 (감지된 계좌번호로)
function quickFraudCheck(accountNumber) {
  if (window.openManualFraudCheck) {
    window.openManualFraudCheck();
    
    // 감지된 계좌번호 자동 입력
    setTimeout(() => {
      const accountInput = document.getElementById('fraudAccountNumberInput');
      if (accountInput) {
        accountInput.value = accountNumber;
        accountInput.focus();
      }
    }, 200);
  }
}

// 계좌번호 감지 알림 닫기
function dismissAccountAlert(button) {
  const alert = button.closest('.account-detection-alert');
  if (alert) {
    alert.style.opacity = '0';
    alert.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      alert.remove();
    }, 300);
  }
}

// 상대방 메시지만 처리
export function handleReceivedMessage(messageText, messageWrapper, senderName) {
  if (!messageText || !messageWrapper) return;
  
  // 현재 사용자인지 다시 한번 체크
  const currentUser = window.currentUser || '';
  if (senderName === currentUser) {
    return;
  }
  
  const detectedAccount = detectAccountNumber(messageText);
  if (detectedAccount) {
    // 1초 후에 알림 표시 (메시지가 완전히 렌더링된 후)
    setTimeout(() => {
      addAccountDetectionAlert(messageWrapper, detectedAccount);
    }, 1000);
  }
}

// ✅ 기존 메시지들 스캔 기능 추가
export function scanExistingMessages() {
  const currentUser = window.currentUser || '';
  
  // 모든 메시지 래퍼 찾기
  const messageWrappers = document.querySelectorAll('.message-wrapper');
  
  messageWrappers.forEach((wrapper) => {
    // 이미 알림창이 있는지 체크
    if (wrapper.querySelector('.account-detection-alert')) {
      return; // 이미 처리된 메시지는 건너뛰기
    }
    
    // 메시지 컨테이너 찾기
    const messageContainer = wrapper.querySelector('.flex');
    if (!messageContainer) return;
    
    // 내 메시지인지 확인 (justify-end 클래스로 판단)
    const isMyMessage = messageContainer.classList.contains('justify-end');
    if (isMyMessage) return; // 내 메시지는 건너뛰기
    
    // 텍스트 메시지 찾기
    const textElement = messageContainer.querySelector('.break-words');
    if (!textElement) return;
    
    const messageText = textElement.textContent;
    const detectedAccount = detectAccountNumber(messageText);
    
    if (detectedAccount) {
      // 기존 메시지에서 발견된 계좌번호에 알림 추가
      addAccountDetectionAlert(wrapper, detectedAccount);
    }
  });
}

// ✅ 수동으로 스캔하는 함수 (필요시 호출 가능)
export function rescanAllMessages() {
  // 기존 알림창들 모두 제거
  document.querySelectorAll('.account-detection-alert').forEach(alert => {
    alert.remove();
  });
  
  // 다시 스캔
  scanExistingMessages();
}