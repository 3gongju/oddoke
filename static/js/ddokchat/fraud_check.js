// static/js/ddokchat/fraud_check.js 수정 및 추가

import { showToast } from './ui_manager.js';

export function setupFraudCheck() {
  // 전역 함수로 노출 (템플릿에서 onclick으로 호출하기 위해)
  window.copyAccountNumber = copyAccountNumber;
  window.copyAddress = copyAddress;
  window.copyPhoneNumber = copyPhoneNumber;  // 🔥 새로 추가
  window.copyDeliveryInfo = copyDeliveryInfo;  // 🔥 새로 추가
  window.checkFraudHistory = checkFraudHistory;
  window.closeFraudModal = closeFraudModal;
}

export function copyAccountNumber(accountNumber) {
  if (!navigator.clipboard) {
    // 클립보드 API가 지원되지 않는 경우 fallback
    const textArea = document.createElement('textarea');
    textArea.value = accountNumber;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('계좌번호가 복사되었습니다. 💳', 'success');
    } catch (err) {
      showToast('복사에 실패했습니다.', 'error');
    }
    document.body.removeChild(textArea);
    return;
  }

  navigator.clipboard.writeText(accountNumber).then(function() {
    // 복사 로그 전송
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                     document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    
    fetch('/ddokchat/copy-account/', {
      method: 'POST',
      headers: {
        'X-CSRFToken': csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_number: accountNumber
      })
    }).catch(error => {
      console.error('복사 로그 전송 실패:', error);
    });
    
    showToast('계좌번호가 복사되었습니다. 💳', 'success');
  }).catch(function(err) {
    console.error('복사 실패:', err);
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
      showToast('주소가 복사되었습니다. 📍', 'success');
    } catch (err) {
      showToast('복사에 실패했습니다.', 'error');
    }
    document.body.removeChild(textArea);
    return;
  }

  navigator.clipboard.writeText(fullAddress).then(function() {
    showToast('주소가 복사되었습니다. 📍', 'success');
  }).catch(function(err) {
    console.error('복사 실패:', err);
    showToast('주소 복사에 실패했습니다.', 'error');
  });
}

// 🔥 새로 추가: 핸드폰 번호 복사 함수
export function copyPhoneNumber(phoneNumber) {
  if (!navigator.clipboard) {
    const textArea = document.createElement('textarea');
    textArea.value = phoneNumber;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('연락처가 복사되었습니다. 📞', 'success');
    } catch (err) {
      showToast('복사에 실패했습니다.', 'error');
    }
    document.body.removeChild(textArea);
    return;
  }

  navigator.clipboard.writeText(phoneNumber).then(function() {
    showToast('연락처가 복사되었습니다. 📞', 'success');
  }).catch(function(err) {
    console.error('복사 실패:', err);
    showToast('연락처 복사에 실패했습니다.', 'error');
  });
}

// 🔥 새로 추가: 배송정보 전체 복사 함수
export function copyDeliveryInfo(phoneNumber, fullAddress) {
  const deliveryText = `
📦 배송정보
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
      showToast('배송정보가 복사되었습니다. 📦', 'success');
    } catch (err) {
      showToast('복사에 실패했습니다.', 'error');
    }
    document.body.removeChild(textArea);
    return;
  }

  navigator.clipboard.writeText(deliveryText).then(function() {
    showToast('배송정보가 복사되었습니다. 📦', 'success');
  }).catch(function(err) {
    console.error('복사 실패:', err);
    showToast('배송정보 복사에 실패했습니다.', 'error');
  });
}

export function checkFraudHistory(bankCode, accountNumber, accountHolder) {
  const modal = document.getElementById('fraudCheckModal');
  const loading = document.getElementById('fraudLoading');
  const noReports = document.getElementById('fraudNoReports');
  const hasReports = document.getElementById('fraudHasReports');
  const errorDiv = document.getElementById('fraudError');
  
  if (!modal) {
    showToast('사기 조회 모달을 찾을 수 없습니다.', 'error');
    return;
  }
  
  modal.classList.remove('hidden');
  loading?.classList.remove('hidden');
  noReports?.classList.add('hidden');
  hasReports?.classList.add('hidden');
  errorDiv?.classList.add('hidden');
  
  // 계좌 정보 표시
  const fraudBankName = document.getElementById('fraudBankName');
  const fraudAccountNumber = document.getElementById('fraudAccountNumber');
  const fraudAccountHolder = document.getElementById('fraudAccountHolder');
  
  if (fraudBankName) fraudBankName.textContent = getBankName(bankCode);
  if (fraudAccountNumber) fraudAccountNumber.textContent = accountNumber;
  if (fraudAccountHolder) fraudAccountHolder.textContent = accountHolder;
  
  // CSRF 토큰 가져오기
  const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                   document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  
  fetch('/ddokchat/check-fraud/', {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bank_code: bankCode,
      account_number: accountNumber,
      account_holder: accountHolder
    })
  })
  .then(response => response.json())
  .then(data => {
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
        hasReports?.classList.remove('hidden');
      } else {
        noReports?.classList.remove('hidden');
      }
    } else {
      const fraudErrorMessage = document.getElementById('fraudErrorMessage');
      if (fraudErrorMessage) {
        fraudErrorMessage.textContent = data.error || '알 수 없는 오류가 발생했습니다.';
      }
      errorDiv?.classList.remove('hidden');
    }
  })
  .catch(error => {
    console.error('사기 조회 오류:', error);
    loading?.classList.add('hidden');
    const fraudErrorMessage = document.getElementById('fraudErrorMessage');
    if (fraudErrorMessage) {
      fraudErrorMessage.textContent = '네트워크 오류가 발생했습니다.';
    }
    errorDiv?.classList.remove('hidden');
  });
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

function getBankName(bankCode) {
  const bankNames = {
    '004': 'KB국민은행',
    '088': '신한은행',
    '020': '우리은행',
    '003': 'IBK기업은행',
    '011': 'NH농협은행',
    '081': 'KEB하나은행',
    '023': 'SC제일은행',
    '090': '카카오뱅크',
    '089': '케이뱅크',
    '092': '토스뱅크',
    '031': '대구은행',
    '032': '부산은행',
    '034': '광주은행',
    '037': '전북은행',
    '039': '경남은행'
  };
  return bankNames[bankCode] || `알 수 없는 은행(${bankCode})`;
}