// static/js/ddokchat/fraud_check.js

import { showToast } from './ui_manager.js';

export function setupFraudCheck() {
  // 전역 함수로 노출 (템플릿에서 onclick으로 호출하기 위해)
  window.copyBankNumber = copyBankNumber;
  window.copyAddress = copyAddress;
  window.copyPhoneNumber = copyPhoneNumber;
  window.copyDeliveryInfo = copyDeliveryInfo;
  window.checkFraudHistory = checkFraudHistory;
  window.closeFraudModal = closeFraudModal;
  window.openManualFraudCheck = openManualFraudCheck;
  
  // 이벤트 리스너 설정
  setupFraudCheckEventListeners();
}

function setupFraudCheckEventListeners() {
  // 수동 사기조회 버튼 (+ 메뉴에서)
  const manualFraudBtn = document.getElementById('manual-fraud-check-btn');
  if (manualFraudBtn) {
    manualFraudBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const plusMenu = document.getElementById('plus-menu');
      if (plusMenu) plusMenu.classList.add('hidden');
      openManualFraudCheck();
    });
  }
  
  // 조회하기 버튼
  const startCheckBtn = document.getElementById('startFraudCheckBtn');
  if (startCheckBtn) {
    startCheckBtn.addEventListener('click', startFraudCheck);
  }
  
  // 뒤로가기 버튼
  const backBtn = document.getElementById('fraudBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', goBackToInput);
  }
  
  // 계좌번호 입력 시 숫자만 허용
  const bankInput = document.getElementById('fraudBankNumberInput');
  if (bankInput) {
    bankInput.addEventListener('input', function(e) {
      // 숫자와 하이픈만 허용
      e.target.value = e.target.value.replace(/[^0-9-]/g, '');
    });
    
    // 엔터키로 조회
    bankInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        startFraudCheck();
      }
    });
  }
}

// 수동 사기조회 모달 열기 (빈 상태)
export function openManualFraudCheck() {
  const modal = document.getElementById('fraudCheckModal');
  const inputStep = document.getElementById('fraudInputStep');
  const resultStep = document.getElementById('fraudResultStep');
  const bankInput = document.getElementById('fraudBankNumberInput');
  
  if (!modal) return;
  
  // 입력 필드 초기화
  if (bankInput) bankInput.value = '';
  
  // Step 1 표시, Step 2 숨김
  inputStep?.classList.remove('hidden');
  resultStep?.classList.add('hidden');
  
  modal.classList.remove('hidden');
  
  // 입력창에 포커스
  setTimeout(() => {
    bankInput?.focus();
  }, 100);
}

// 기존 계좌정보에서 사기조회 (자동입력) - 예금주명 제거
export function checkFraudHistory(bankCode, bankNumber, bankHolder) {
  const modal = document.getElementById('fraudCheckModal');
  const inputStep = document.getElementById('fraudInputStep');
  const resultStep = document.getElementById('fraudResultStep');
  const bankInput = document.getElementById('fraudBankNumberInput');
  
  if (!modal) return;
  
  // 계좌번호만 자동 입력 (예금주명 제거)
  if (bankInput) bankInput.value = bankNumber || '';
  
  // Step 1 표시, Step 2 숨김
  inputStep?.classList.remove('hidden');
  resultStep?.classList.add('hidden');
  
  modal.classList.remove('hidden');
}

// 조회 시작
function startFraudCheck() {
  const bankNumber = document.getElementById('fraudBankNumberInput')?.value?.trim();
  
  if (!bankNumber) {
    showToast('계좌번호를 입력해주세요.', 'error');
    document.getElementById('fraudBankNumberInput')?.focus();
    return;
  }
  
  // 계좌번호 기본 검증 (최소 10자리)
  if (bankNumber.length < 10) {
    showToast('올바른 계좌번호를 입력해주세요. (최소 10자리)', 'error');
    return;
  }
  
  // Step 2로 전환
  showResultStep(bankNumber);
  
  // 실제 조회 실행
  performFraudCheck(bankNumber);
}

// 결과 단계로 전환 - 예금주명 관련 코드 제거
function showResultStep(bankNumber) {
  const inputStep = document.getElementById('fraudInputStep');
  const resultStep = document.getElementById('fraudResultStep');
  const loading = document.getElementById('fraudLoading');
  const noReports = document.getElementById('fraudNoReports');
  const hasReports = document.getElementById('fraudHasReports');
  const errorDiv = document.getElementById('fraudError');
  
  // Step 전환
  inputStep?.classList.add('hidden');
  resultStep?.classList.remove('hidden');
  
  // 결과 영역 초기화
  loading?.classList.remove('hidden');
  noReports?.classList.add('hidden');
  hasReports?.classList.add('hidden');
  errorDiv?.classList.add('hidden');
  
  // 조회된 계좌 정보 표시 (계좌번호만)
  const displayBankNumber = document.getElementById('fraudDisplayBankNumber');
  
  if (displayBankNumber) {
    displayBankNumber.textContent = bankNumber;
  }
}

// 실제 사기조회 API 호출 - 예금주명 제거
function performFraudCheck(bankNumber) {
  const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                   document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  
  fetch('/ddokchat/check-fraud/', {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bank_code: '', // 빈 값으로 (계좌번호만으로 조회)
      bank_number: bankNumber,
      bank_holder: '' // 예금주명 제거
    })
  })
  .then(response => response.json())
  .then(data => {
    const loading = document.getElementById('fraudLoading');
    loading?.classList.add('hidden');
    
    if (data.success) {
      const fraudLastUpdated = document.getElementById('fraudLastUpdated');
      if (fraudLastUpdated) {
        fraudLastUpdated.textContent = data.last_updated || '알 수 없음';
      }
      
      if (data.has_reports && data.report_count > 0) {
        const fraudReportCount = document.getElementById('fraudReportCount');
        if (fraudReportCount) {
          fraudReportCount.textContent = data.report_count;
        }
        displayFraudReports(data.reports);
        document.getElementById('fraudHasReports')?.classList.remove('hidden');
      } else {
        document.getElementById('fraudNoReports')?.classList.remove('hidden');
      }
    } else {
      const fraudErrorMessage = document.getElementById('fraudErrorMessage');
      if (fraudErrorMessage) {
        fraudErrorMessage.textContent = data.error || '알 수 없는 오류가 발생했습니다.';
      }
      document.getElementById('fraudError')?.classList.remove('hidden');
    }
  })
  .catch(error => {
    const loading = document.getElementById('fraudLoading');
    loading?.classList.add('hidden');
    
    const fraudErrorMessage = document.getElementById('fraudErrorMessage');
    if (fraudErrorMessage) {
      fraudErrorMessage.textContent = '네트워크 오류가 발생했습니다.';
    }
    document.getElementById('fraudError')?.classList.remove('hidden');
  });
}

// 입력 단계로 돌아가기
function goBackToInput() {
  const inputStep = document.getElementById('fraudInputStep');
  const resultStep = document.getElementById('fraudResultStep');
  
  inputStep?.classList.remove('hidden');
  resultStep?.classList.add('hidden');
  
  // 입력창에 포커스
  setTimeout(() => {
    document.getElementById('fraudBankNumberInput')?.focus();
  }, 100);
}

function displayFraudReports(reports) {
  const reportsList = document.getElementById('fraudReportsList');
  if (!reportsList) return;
  
  reportsList.innerHTML = '';
  
  reports.forEach(function(report, index) {
    const reportDiv = document.createElement('div');
    reportDiv.className = 'bg-white border border-red-200 rounded-lg p-3';
    
    const statusClass = report.status === '확인됨' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
    
    reportDiv.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <h4 class="font-semibold text-gray-800">${report.report_type}</h4>
        <span class="px-2 py-1 text-xs rounded-full ${statusClass}">${report.status}</span>
      </div>
      <p class="text-sm text-gray-600 mb-2">${report.description}</p>
      <div class="flex justify-between text-xs text-gray-500">
        <span>신고일: ${report.report_date}</span>
        <span class="font-medium text-red-600">피해금액: ${report.amount.toLocaleString()}원</span>
      </div>
    `;
    
    reportsList.appendChild(reportDiv);
  });
}

export function closeFraudModal() {
  const modal = document.getElementById('fraudCheckModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// 기존 복사 함수들 유지
export function copyBankNumber(bankNumber) {
  if (!navigator.clipboard) {
    const textArea = document.createElement('textarea');
    textArea.value = bankNumber;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('계좌번호가 복사되었습니다.', 'success');
    } catch (err) {
      showToast('복사에 실패했습니다.', 'error');
    }
    document.body.removeChild(textArea);
    return;
  }

  navigator.clipboard.writeText(bankNumber).then(function() {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                     document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    
    fetch('/ddokchat/copy-bank/', {
      method: 'POST',
      headers: {
        'X-CSRFToken': csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bank_number: bankNumber
      })
    }).catch(error => {
      console.error('복사 로그 전송 실패:', error);
    });
    
    showToast('계좌번호가 복사되었습니다.', 'success');
  }).catch(function(err) {
    showToast('계좌번호 복사에 실패했습니다.', 'error');
  });
}

export function copyAddress(fullAddress) {
  if (!navigator.clipboard) {
    const textArea = document.createElement('textarea');
    textArea.value = fullAddress;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('주소가 복사되었습니다.', 'success');
    } catch (err) {
      showToast('복사에 실패했습니다.', 'error');
    }
    document.body.removeChild(textArea);
    return;
  }

  navigator.clipboard.writeText(fullAddress).then(function() {
    showToast('주소가 복사되었습니다.', 'success');
  }).catch(function(err) {
    showToast('주소 복사에 실패했습니다.', 'error');
  });
}

export function copyPhoneNumber(phoneNumber) {
  if (!navigator.clipboard) {
    const textArea = document.createElement('textarea');
    textArea.value = phoneNumber;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('연락처가 복사되었습니다.', 'success');
    } catch (err) {
      showToast('복사에 실패했습니다.', 'error');
    }
    document.body.removeChild(textArea);
    return;
  }

  navigator.clipboard.writeText(phoneNumber).then(function() {
    showToast('연락처가 복사되었습니다.', 'success');
  }).catch(function(err) {
    showToast('연락처 복사에 실패했습니다.', 'error');
  });
}

export function copyDeliveryInfo(phoneNumber, fullAddress) {
  const deliveryText = `
배송정보
연락처: ${phoneNumber}
주소: ${fullAddress}
  `.trim();

  if (!navigator.clipboard) {
    const textArea = document.createElement('textarea');
    textArea.value = deliveryText;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('배송정보가 복사되었습니다.', 'success');
    } catch (err) {
      showToast('복사에 실패했습니다.', 'error');
    }
    document.body.removeChild(textArea);
    return;
  }

  navigator.clipboard.writeText(deliveryText).then(function() {
    showToast('배송정보가 복사되었습니다.', 'success');
  }).catch(function(err) {
    showToast('배송정보 복사에 실패했습니다.', 'error');
  });
}