// static/js/ddokchat/auto_detect.js

import { showToast } from './ui_manager.js';

export function setupAutoDetect() {
  // 전역 함수로 노출
  window.quickFraudCheck = quickFraudCheck;
  window.dismissBankAlert = dismissBankAlert;
  
  // 페이지 로드 후 기존 메시지들 스캔
  setTimeout(() => {
    scanExistingMessages();
  }, 1500);
}

// 계좌번호 패턴 감지 함수 - 실제 한국 은행 패턴 기반
export function detectBankNumber(message) {
  if (!message || typeof message !== 'string') return null;
  
  // 010으로 시작하는 전화번호 제외
  if (message.includes('010')) return null;
  
  const patterns = [
    // 1. 하이픈 없는 연속 숫자 (10~14자리)
    /\b(?!010)\d{10,14}\b/g,
    
    // 2. 실제 은행 패턴들
    /\b(?!010)\d{4}-\d{2}-\d{8}\b/g,          // KB국민은행: 1234-56-78901234
    /\b(?!010)\d{3}-\d{8}-\d{1}\b/g,          // 신한은행: 123-45678901-2
    /\b(?!010)\d{3}-\d{3}-\d{7}\b/g,          // 우리은행: 123-456-7890123
    /\b(?!010)\d{3}-\d{6}-\d{2}-\d{3}\b/g,    // 하나은행: 123-456789-01-234
    /\b(?!010)\d{3}-\d{2}-\d{7}\b/g,          // 농협은행: 123-45-6789012
    /\b(?!010)\d{4}-\d{2}-\d{7}\b/g,          // 카카오뱅크: 3333-12-3456789
    /\b(?!010)\d{4}-\d{4}-\d{4}\b/g,          // 토스뱅크: 1000-1234-5678
    
    // 3. 범용 패턴들 (위에서 안잡힌 것들)
    /\b(?!010)\d{3,4}-\d{2,6}-\d{6,8}\b/g,    // 3~4자리-2~6자리-6~8자리
    /\b(?!010)\d{3,4}-\d{6,8}-\d{1,3}\b/g,    // 3~4자리-6~8자리-1~3자리
    /\b(?!010)\d{2,4}-\d{2,4}-\d{4,8}\b/g     // 유연한 패턴
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

// 메시지 래퍼 하단에 계좌번호 감지 알림 추가 - 크기 개선
export function addBankDetectionAlert(messageWrapper, detectedBank) {
  if (!messageWrapper) {
    return;
  }
  
  // 이미 알림이 있는지 체크
  if (messageWrapper.querySelector('.bank-detection-alert')) {
    return;
  }
  
  const alertDiv = document.createElement('div');
  
  // ✅ 크기를 더 크게 조정 (max-w-md로 변경)
  alertDiv.className = 'bank-detection-alert mt-4 max-w-md mx-2';
  alertDiv.innerHTML = `
    <div class="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 transition-all duration-300 shadow-sm">
      <div class="flex flex-col gap-4">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 mt-0.5">
            <svg class="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z"></path>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm text-orange-800 font-semibold leading-relaxed mb-1">
              계좌번호가 감지되었습니다
            </div>
            <p class="text-xs text-orange-700 leading-relaxed">
              안전한 거래를 위해 사기이력 조회를 권장합니다
            </p>
          </div>
          <button 
            onclick="dismissBankAlert(this)" 
            class="flex-shrink-0 text-orange-400 hover:text-orange-600 transition-colors p-1 rounded-full hover:bg-orange-100"
            title="닫기"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div class="flex items-center justify-center">
          <button 
            onclick="quickFraudCheck('${detectedBank}')" 
            class="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg transition-colors font-semibold text-sm shadow-sm hover:shadow-md flex items-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            사기이력 조회하기
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
  alertDiv.style.transform = 'translateY(-15px)';
  alertDiv.style.transition = 'all 0.4s ease-out';
  
  setTimeout(() => {
    alertDiv.style.opacity = '1';
    alertDiv.style.transform = 'translateY(0)';
    
    // 애니메이션 완료 후 부드럽게 스크롤
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
function quickFraudCheck(bankNumber) {
  if (window.openManualFraudCheck) {
    window.openManualFraudCheck();
    
    // 감지된 계좌번호 자동 입력
    setTimeout(() => {
      const bankInput = document.getElementById('fraudBankNumberInput');
      if (bankInput) {
        bankInput.value = bankNumber;
        bankInput.focus();
      }
    }, 200);
  }
}

// 계좌번호 감지 알림 닫기
function dismissBankAlert(button) {
  const alert = button.closest('.bank-detection-alert');
  if (alert) {
    alert.style.opacity = '0';
    alert.style.transform = 'translateY(-15px)';
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
  
  const detectedBank = detectBankNumber(messageText);
  if (detectedBank) {
    // 1초 후에 알림 표시 (메시지가 완전히 렌더링된 후)
    setTimeout(() => {
      addBankDetectionAlert(messageWrapper, detectedBank);
    }, 1000);
  }
}

// ✅ 기존 메시지들 스캔 기능 - 이제 .message-wrapper 클래스를 찾을 수 있음
export function scanExistingMessages() {
  const currentUser = window.currentUser || '';
  
  // 모든 메시지 래퍼 찾기 (템플릿에도 추가했으므로 이제 찾을 수 있음)
  const messageWrappers = document.querySelectorAll('.message-wrapper');
  
  messageWrappers.forEach((wrapper) => {
    // 이미 알림창이 있는지 체크
    if (wrapper.querySelector('.bank-detection-alert')) {
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
    const detectedBank = detectBankNumber(messageText);
    
    if (detectedBank) {
      // 기존 메시지에서 발견된 계좌번호에 알림 추가
      addBankDetectionAlert(wrapper, detectedBank);
    }
  });
}

// 수동으로 스캔하는 함수 (필요시 호출 가능)
export function rescanAllMessages() {
  // 기존 알림창들 모두 제거
  document.querySelectorAll('.bank-detection-alert').forEach(alert => {
    alert.remove();
  });
  
  // 다시 스캔
  scanExistingMessages();
}