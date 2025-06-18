// static/js/ddokchat/auto_detect.js (새 파일)

import { showToast } from './ui_manager.js';

export function setupAutoDetect() {
  // 전역 함수로 노출
  window.quickFraudCheck = quickFraudCheck;
  window.dismissAccountAlert = dismissAccountAlert;
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

// 메시지에 계좌번호 감지 알림 추가
export function addAccountDetectionAlert(messageContainer, detectedAccount) {
  // 이미 알림이 있는지 체크
  if (messageContainer.querySelector('.account-detection-alert')) {
    return;
  }
  
  const alertDiv = document.createElement('div');
  alertDiv.className = 'account-detection-alert bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2 transition-all duration-300';
  
  alertDiv.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z"></path>
        </svg>
        <span class="text-sm text-blue-800 font-medium">
          계좌번호가 감지되었습니다. 사기이력 조회를 할까요?
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button 
          onclick="quickFraudCheck('${detectedAccount}')" 
          class="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
        >
          조회하기
        </button>
        <button 
          onclick="dismissAccountAlert(this)" 
          class="text-blue-400 hover:text-blue-600 transition-colors"
          title="닫기"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  messageContainer.appendChild(alertDiv);
  
  // 등장 애니메이션
  setTimeout(() => {
    alertDiv.style.opacity = '0';
    alertDiv.style.transform = 'translateY(-10px)';
    alertDiv.style.transition = 'all 0.3s ease-out';
    
    setTimeout(() => {
      alertDiv.style.opacity = '1';
      alertDiv.style.transform = 'translateY(0)';
    }, 10);
  }, 100);
}

// 빠른 사기조회 (감지된 계좌번호로)
function quickFraudCheck(accountNumber) {
  // fraud_check.js의 함수 사용
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

// 메시지 전송 후 자동 감지 처리
export function handleMessageSent(messageText, messageContainer) {
  if (!messageText || !messageContainer) return;
  
  const detectedAccount = detectAccountNumber(messageText);
  if (detectedAccount) {
    console.log('계좌번호 감지됨:', detectedAccount);
    
    // 1초 후에 알림 표시 (메시지가 완전히 렌더링된 후)
    setTimeout(() => {
      addAccountDetectionAlert(messageContainer, detectedAccount);
    }, 1000);
  }
}