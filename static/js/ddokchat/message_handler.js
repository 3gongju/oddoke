// static/js/ddokchat/message_handler.js - 간소화된 버전

import { 
  scrollToBottom, 
  scrollToBottomAfterImageLoad, 
  registerObserver, 
  updateSensitiveInfoCards, 
  updateUIAfterTradeComplete,
  showToast
} from './ui_manager.js';
import { handleReceivedMessage } from './auto_detect.js';

let currentUser = '';
let currentUserId = '';
let chatLog;

export function setupMessageHandlers(user, userId) {
  currentUser = user;
  currentUserId = userId;
  chatLog = document.getElementById('chat-log');
}

// 기존 메시지 핸들러들은 그대로 유지 (텍스트, 이미지, 계좌, 주소)
export function handleTextMessage(data) {
  const isMine = data.sender === currentUser;
  
  const messageWrapper = document.createElement("div");
  messageWrapper.className = `message-wrapper mb-3`;
  
  const messageContainer = document.createElement("div");
  messageContainer.className = `flex ${isMine ? 'justify-end' : 'justify-start'} group message-enter`;
  
  if (isMine) {
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <div class="flex flex-col items-end text-xs text-gray-400 gap-0.5 mb-1">
          ${!data.is_read ? '<span class="unread-label">안읽음</span>' : ''}
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
        <div class="max-w-xs">
          <div class="bg-gray-900 text-white px-4 py-2 rounded-2xl rounded-br-md shadow-sm">
            <p class="text-sm break-words">${data.message}</p>
          </div>
        </div>
      </div>`;
  } else {
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <div class="max-w-xs">
          <div class="bg-white text-gray-800 px-4 py-2 rounded-2xl rounded-bl-md shadow-sm border border-gray-200">
            <p class="text-sm break-words">${data.message}</p>
          </div>
        </div>
        <div class="flex flex-col items-start text-xs text-gray-400 gap-0.5 mb-1">
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
      </div>`;
  }
  
  messageWrapper.appendChild(messageContainer);
  
  if (chatLog) {
    chatLog.appendChild(messageWrapper);
    registerObserver(messageContainer, data.sender);
    scrollToBottom();
    
    if (!isMine) {
      setTimeout(() => {
        handleReceivedMessage(data.message, messageWrapper, data.sender);
      }, 1000);
    }
  }
}

export function handleImageMessage(data) {
  const isMine = data.sender === currentUser;
  const messageContainer = document.createElement("div");
  messageContainer.className = `flex ${isMine ? 'justify-end' : 'justify-start'} message-enter mb-3`;

  if (isMine) {
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <div class="flex flex-col items-end text-xs text-gray-400 gap-0.5 mb-1">
          ${!data.is_read ? '<span class="unread-label">안읽음</span>' : ''}
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
        <div class="max-w-xs">
          <div class="bg-gray-900 text-white px-3 py-2 rounded-2xl rounded-br-md shadow-sm message-image">
            <img src="${data.image_url}" alt="전송 이미지" class="w-full max-h-64 rounded-lg object-cover image-loading" data-taken-datetime="${data.taken_datetime || ''}">
          </div>
        </div>
      </div>`;
  } else {
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <div class="max-w-xs">
          <div class="bg-white text-gray-800 border border-gray-200 px-3 py-2 rounded-2xl rounded-bl-md shadow-sm message-image">
            <img src="${data.image_url}" alt="전송 이미지" class="w-full max-h-64 rounded-lg object-cover image-loading" data-taken-datetime="${data.taken_datetime || ''}">
          </div>
        </div>
        <div class="flex flex-col items-start text-xs text-gray-400 gap-0.5 mb-1">
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
      </div>`;
  }

  if (chatLog) {
    chatLog.appendChild(messageContainer);
    registerObserver(messageContainer, data.sender);
    
    const imgElement = messageContainer.querySelector('img');
    if (imgElement) {
      imgElement.style.opacity = '0.7';
      
      imgElement.onload = function() {
        this.style.opacity = '1';
        this.classList.remove('image-loading');
        scrollToBottom();
      };
      
      imgElement.onerror = function() {
        this.style.opacity = '1';
        this.classList.remove('image-loading');
        scrollToBottom();
      };
      
      if (imgElement.complete) {
        imgElement.style.opacity = '1';
        imgElement.classList.remove('image-loading');
        scrollToBottom();
      }
      
      setTimeout(() => {
        imgElement.style.opacity = '1';
        imgElement.classList.remove('image-loading');
        scrollToBottom();
      }, 3000);
    } else {
      scrollToBottom();
    }
  }
}

export function handleBankMessage(data) {
  const bankInfo = data.bank_info;
  const isMine = data.sender === currentUser;
  
  const messageContainer = document.createElement("div");
  messageContainer.className = `flex ${isMine ? 'justify-end' : 'justify-start'} message-enter mb-3`;

  let buttonsHtml = '';
  if (!isMine && !bankInfo.is_deleted) {
    buttonsHtml = `
      <div class="flex space-x-2 mt-3">
        <button onclick="copyBankNumber('${bankInfo.bank_number}')" 
                class="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-2 rounded-lg transition-colors action-button">
          계좌번호 복사
        </button>
        <button onclick="checkFraudHistory('${bankInfo.bank_code || ''}', '${bankInfo.bank_number}', '${bankInfo.bank_holder}')" 
                class="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-2 rounded-lg transition-colors action-button">
          신고이력 조회
        </button>
      </div>
    `;
  }

  let contentHtml = '';
  if (bankInfo.is_deleted) {
    contentHtml = `
      <div class="bg-${isMine ? 'gray-800' : 'gray-100'} rounded-lg p-4 text-center">
        <p class="text-sm ${isMine ? 'text-gray-300' : 'text-gray-600'} font-medium">계좌정보가 삭제되었습니다</p>
        <p class="text-xs ${isMine ? 'text-gray-400' : 'text-gray-500'} mt-1">개인정보 보호를 위해 자동으로 삭제되었습니다</p>
      </div>
    `;
  } else {
    contentHtml = `
      <div class="bg-${isMine ? 'gray-800' : 'gray-50'} rounded-lg p-${isMine ? '4' : '3'} space-y-2 info-card ${isMine ? 'min-w-[220px]' : ''}">
        <div class="flex justify-between">
          <span class="text-xs ${isMine ? 'text-gray-300' : 'text-gray-600'}">은행</span>
          <span class="text-sm">${bankInfo.bank_name}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-xs ${isMine ? 'text-gray-300' : 'text-gray-600'}">계좌번호</span>
          <span class="text-sm">${bankInfo.bank_number}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-xs ${isMine ? 'text-gray-300' : 'text-gray-600'}">예금주</span>
          <span class="text-sm">${bankInfo.bank_holder}</span>
        </div>
      </div>
      ${buttonsHtml}
    `;
  }

  const creditCardIcon = `
    <svg class="w-4 h-4 ${isMine ? 'text-white' : 'text-blue-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"></path>
    </svg>
  `;

  if (isMine) {
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <div class="flex flex-col items-end text-xs text-gray-400 gap-0.5 mb-1">
          ${!data.is_read ? '<span class="unread-label">안읽음</span>' : ''}
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
        <div class="max-w-sm">
          <div class="bg-gray-900 text-white px-4 py-3 rounded-2xl rounded-br-md shadow-sm">
            <div class="space-y-3">
             <div class="flex items-center space-x-2 mb-2">
               ${creditCardIcon}
               <span class="text-sm">계좌정보 전송</span>
             </div>
             ${contentHtml}
           </div>
         </div>
       </div>
     </div>`;
 } else {
   messageContainer.innerHTML = `
     <div class="flex items-end gap-2">
       <div class="max-w-sm">
         <div class="bg-white text-gray-800 border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
           <div class="space-y-3">
             <div class="flex items-center space-x-2 mb-2">
               ${creditCardIcon}
               <span class="text-sm">계좌정보</span>
             </div>
             ${contentHtml}
           </div>
         </div>
       </div>
       <div class="flex flex-col items-start text-xs text-gray-400 gap-0.5 mb-1">
         <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
       </div>
     </div>`;
 }
 
 if (chatLog) {
   chatLog.appendChild(messageContainer);
   registerObserver(messageContainer, data.sender);
   scrollToBottom();
 }
}

export function handleAddressMessage(data) {
 const addressInfo = data.address_info;
 const isMine = data.sender === currentUser;
 
 const messageContainer = document.createElement("div");
 messageContainer.className = `flex ${isMine ? 'justify-end' : 'justify-start'} message-enter mb-3`;

 let buttonsHtml = '';
 if (!isMine && !addressInfo.is_deleted) {
   buttonsHtml = `
     <div class="flex space-x-2 mt-3">
       <button onclick="copyDeliveryInfo('${addressInfo.phone_number}', '${addressInfo.full_address}')" 
               class="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-2 rounded-lg transition-colors action-button">
         배송정보 복사
       </button>
       <button onclick="copyPhoneNumber('${addressInfo.phone_number}')" 
               class="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-2 rounded-lg transition-colors action-button">
         연락처 복사
       </button>
     </div>
   `;
 }

 let contentHtml = '';
 if (addressInfo.is_deleted) {
   contentHtml = `
     <div class="bg-${isMine ? 'gray-800' : 'gray-100'} rounded-lg p-4 text-center">
       <p class="text-sm ${isMine ? 'text-gray-300' : 'text-gray-600'} font-medium">배송정보가 삭제되었습니다</p>
       <p class="text-xs ${isMine ? 'text-gray-400' : 'text-gray-500'} mt-1">개인정보 보호를 위해 자동으로 삭제되었습니다</p>
     </div>
   `;
 } else {
   contentHtml = `
     <div class="bg-${isMine ? 'gray-800' : 'gray-50'} rounded-lg p-${isMine ? '4' : '3'} space-y-2 info-card ${isMine ? 'min-w-[220px]' : ''}">
       <div class="flex justify-between">
         <span class="text-xs ${isMine ? 'text-gray-300' : 'text-gray-600'}">연락처</span>
         <span class="text-sm">${addressInfo.phone_number}</span>
       </div>
       <div class="flex justify-between">
         <span class="text-xs ${isMine ? 'text-gray-300' : 'text-gray-600'}">우편번호</span>
         <span class="text-sm">${addressInfo.postal_code}</span>
       </div>
       <div>
         <span class="text-xs ${isMine ? 'text-gray-300' : 'text-gray-600'}">배송주소</span>
         <p class="text-sm mt-1">${addressInfo.full_address}</p>
       </div>
     </div>
     ${buttonsHtml}
   `;
 }

 const mapPinIcon = `
   <svg class="w-4 h-4 ${isMine ? 'text-white' : 'text-green-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"></path>
     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1 1 15 0Z"></path>
   </svg>
 `;

 if (isMine) {
   messageContainer.innerHTML = `
     <div class="flex items-end gap-2">
       <div class="flex flex-col items-end text-xs text-gray-400 gap-0.5 mb-1">
         ${!data.is_read ? '<span class="unread-label">안읽음</span>' : ''}
         <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
       </div>
       <div class="max-w-sm">
         <div class="bg-gray-900 text-white px-4 py-3 rounded-2xl rounded-br-md shadow-sm">
           <div class="space-y-3">
             <div class="flex items-center space-x-2 mb-2">
               ${mapPinIcon}
               <span class="text-sm">배송정보 전송</span>
             </div>
             ${contentHtml}
           </div>
         </div>
       </div>
     </div>`;
 } else {
   messageContainer.innerHTML = `
     <div class="flex items-end gap-2">
       <div class="max-w-sm">
         <div class="bg-white text-gray-800 border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
           <div class="space-y-3">
             <div class="flex items-center space-x-2 mb-2">
               ${mapPinIcon}
               <span class="text-sm">배송정보</span>
             </div>
             ${contentHtml}
           </div>
         </div>
       </div>
       <div class="flex flex-col items-start text-xs text-gray-400 gap-0.5 mb-1">
         <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
       </div>
     </div>`;
 }
 
 if (chatLog) {
   chatLog.appendChild(messageContainer);
   registerObserver(messageContainer, data.sender);
   scrollToBottom();
 }
}

// 읽음 처리 관련 핸들러들 (기존과 동일)
export function handleReadUpdate(data) {
 document.querySelectorAll(".unread-label").forEach(el => el.remove());
}

export function handleReadMessageSyncFinish(data) {
 document.querySelectorAll(".unread-label").forEach(el => el.remove());
}

export function handleEnterChatroomFinish(data) {
 const currentUser = window.currentUser || '';
 if (data.reader !== currentUser) {
   document.querySelectorAll(".unread-label").forEach(el => el.remove());
 }
}

// 🔥 간소화된 거래완료 핸들러 (양쪽 모두 완료)
export function handleTradeCompleted(data) {
  updateSensitiveInfoCards();
  updateUIAfterTradeComplete(true);
  
  // 🔥 구매자인 경우 즉시 리뷰 모달 표시
  const currentUser = window.currentUser || '';
  const roomBuyer = window.roomBuyer || '';
  const isBuyer = currentUser === roomBuyer;
  
  if (isBuyer) {
    const hasAlreadyReviewed = window.hasAlreadyReviewed || false;
    if (!hasAlreadyReviewed) {
      setTimeout(() => {
        showReviewRedirectModal();
      }, 1000);
    }
  }
}

// 🔥 간소화된 거래 진행 알림 핸들러 (상대방용 실시간 업데이트만)
export function handleTradeProgressNotification(data) {
  const currentUser = window.currentUser || '';
  const completedUser = data.completed_user;
  
  // 🔥 간소화: 상대방에게만 토스트 메시지 표시
  showToast(`${completedUser}님이 거래완료를 요청했습니다.`, 'info');
  
  // UI 상태는 새로고침으로 처리 (간단함)
  setTimeout(() => {
    location.reload();
  }, 2000);
}

// 🔥 간소화된 거래 취소 알림
export function handleTradeCancelNotification(data) {
  const action = data.action;
  
  switch (action) {
    case 'request':
      showToast('상대방이 거래 취소를 요청했습니다.', 'info');
      break;
    case 'cancelled':
      showToast('거래가 취소되었습니다.', 'error');
      break;
    case 'rejected':
      showToast('거래 취소 요청이 거절되었습니다.', 'info');
      break;
    case 'withdrawn':
      showToast('상대방이 거래 취소 요청을 철회했습니다.', 'info');
      break;
  }
  
  // 간단하게 새로고침으로 처리
  setTimeout(() => {
    location.reload();
  }, 2000);
}

// 거래 상태 업데이트 핸들러 (게시글에서 거래완료 시)
export function handleTradeStatusUpdate(data) {
  if (data.post_marked_sold && data.seller_completed) {
    showToast('게시글이 거래완료 처리되었습니다.', 'info');
    
    setTimeout(() => {
      location.reload();
    }, 1500);
  }
}

// 🔥 리뷰 페이지 이동 모달 표시 함수
function showReviewRedirectModal() {
  const modal = document.getElementById('reviewRedirectModal');
  if (modal) {
    modal.classList.remove('hidden');
    
    // 버튼 이벤트 설정
    const laterBtn = document.getElementById('reviewRedirectLater');
    const nowBtn = document.getElementById('reviewRedirectNow');
    
    if (laterBtn) {
      laterBtn.onclick = function() {
        modal.classList.add('hidden');
      };
    }
    
    if (nowBtn) {
      nowBtn.onclick = function() {
        modal.classList.add('hidden');
        // 🔥 수정: 새로운 리뷰 작성 페이지로 이동
        const otherUser = window.roomSeller || getOtherUserFromHeader();
        if (otherUser) {
          window.location.href = `/accounts/${otherUser}/review/write/?room_code=${window.roomCode}`;
        } else {
          showToast('리뷰 페이지로 이동할 수 없습니다.', 'error');
        }
      };
    }
    
    // 모달 외부 클릭 시 닫기
    modal.onclick = function(e) {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    };
  }
}

// 헤더에서 상대방 사용자명 추출
function getOtherUserFromHeader() {
  const userNameElement = document.querySelector('.bg-gray-50 h2.font-semibold');
  if (userNameElement) {
    return userNameElement.textContent.trim();
  }
  return null;
}

// 전역 함수로 노출
window.showReviewRedirectModal = showReviewRedirectModal;