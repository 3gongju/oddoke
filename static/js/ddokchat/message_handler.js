// static/js/ddokchat/message_handler.js

import { 
  scrollToBottom, 
  scrollToBottomAfterImageLoad, 
  registerObserver, 
  updateSensitiveInfoCards, 
  updateUIAfterTradeComplete,
  showToast  // ✅ showToast import 추가
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

export function handleTextMessage(data) {
  const isMine = data.sender === currentUser;
  
  // 전체 메시지 래퍼 생성 (세로 배치)
  const messageWrapper = document.createElement("div");
  messageWrapper.className = `message-wrapper mb-3`;
  
  // 기존 메시지 컨테이너 (가로 배치)
  const messageContainer = document.createElement("div");
  messageContainer.className = `flex ${isMine ? 'justify-end' : 'justify-start'} group message-enter`;
  
  if (isMine) {
    // 내 메시지: 시간/읽음상태가 말풍선 왼쪽에
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <!-- 시간/읽음상태 (왼쪽) -->
        <div class="flex flex-col items-end text-xs text-gray-400 gap-0.5 mb-1">
          ${!data.is_read ? '<span class="unread-label">안읽음</span>' : ''}
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
        
        <!-- 말풍선 (오른쪽) -->
        <div class="max-w-xs">
          <div class="bg-gray-900 text-white px-4 py-2 rounded-2xl rounded-br-md shadow-sm">
            <p class="text-sm break-words">${data.message}</p>
          </div>
        </div>
      </div>`;
  } else {
    // 상대방 메시지: 시간/읽음상태가 말풍선 오른쪽에 (닉네임 제거)
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <!-- 말풍선 (왼쪽) -->
        <div class="max-w-xs">
          <div class="bg-white text-gray-800 px-4 py-2 rounded-2xl rounded-bl-md shadow-sm border border-gray-200">
            <p class="text-sm break-words">${data.message}</p>
          </div>
        </div>
        
        <!-- 시간 (오른쪽) -->
        <div class="flex flex-col items-start text-xs text-gray-400 gap-0.5 mb-1">
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
      </div>`;
  }
  
  // 메시지를 래퍼에 추가
  messageWrapper.appendChild(messageContainer);
  
  if (chatLog) {
    // 래퍼를 채팅 로그에 추가
    chatLog.appendChild(messageWrapper);
    
    registerObserver(messageContainer, data.sender);
    scrollToBottom();
    
    // 상대방이 보낸 메시지에서만 자동 감지 (래퍼를 전달)
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
    // 내 메시지: 시간/읽음상태가 말풍선 왼쪽에
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <!-- 시간/읽음상태 (왼쪽) -->
        <div class="flex flex-col items-end text-xs text-gray-400 gap-0.5 mb-1">
          ${!data.is_read ? '<span class="unread-label">안읽음</span>' : ''}
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
        
        <!-- 말풍선 (오른쪽) -->
        <div class="max-w-xs">
          <div class="bg-gray-900 text-white px-3 py-2 rounded-2xl rounded-br-md shadow-sm message-image">
            <img src="${data.image_url}" alt="전송 이미지" class="w-full max-h-64 rounded-lg object-cover image-loading" data-taken-datetime="${data.taken_datetime || ''}">
          </div>
        </div>
      </div>`;
  } else {
    // 상대방 메시지: 시간/읽음상태가 말풍선 오른쪽에
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <!-- 말풍선 (왼쪽) -->
        <div class="max-w-xs">
          <div class="bg-white text-gray-800 border border-gray-200 px-3 py-2 rounded-2xl rounded-bl-md shadow-sm message-image">
            <img src="${data.image_url}" alt="전송 이미지" class="w-full max-h-64 rounded-lg object-cover image-loading" data-taken-datetime="${data.taken_datetime || ''}">
          </div>
        </div>
        
        <!-- 시간 (오른쪽) -->
        <div class="flex flex-col items-start text-xs text-gray-400 gap-0.5 mb-1">
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
      </div>`;
  }

  if (chatLog) {
    chatLog.appendChild(messageContainer);
    registerObserver(messageContainer, data.sender);
    
    // 이미지 로딩 처리
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

  // Heroicons Credit Card Icon SVG
  const creditCardIcon = `
    <svg class="w-4 h-4 ${isMine ? 'text-white' : 'text-blue-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"></path>
    </svg>
  `;

  if (isMine) {
    // 내 메시지: 시간/읽음상태가 말풍선 왼쪽에
    messageContainer.innerHTML = `
      <div class="flex items-end gap-2">
        <!-- 시간/읽음상태 (왼쪽) -->
        <div class="flex flex-col items-end text-xs text-gray-400 gap-0.5 mb-1">
          ${!data.is_read ? '<span class="unread-label">안읽음</span>' : ''}
          <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
        </div>
        
        <!-- 말풍선 (오른쪽) -->
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
   // 상대방 메시지: 시간/읽음상태가 말풍선 오른쪽에 (닉네임 제거)
   messageContainer.innerHTML = `
     <div class="flex items-end gap-2">
       <!-- 말풍선 (왼쪽) -->
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
       
       <!-- 시간 (오른쪽) -->
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

 // Heroicons Map Pin Icon SVG
 const mapPinIcon = `
   <svg class="w-4 h-4 ${isMine ? 'text-white' : 'text-green-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"></path>
     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1 1 15 0Z"></path>
   </svg>
 `;

 if (isMine) {
   // 내 메시지: 시간/읽음상태가 말풍선 왼쪽에
   messageContainer.innerHTML = `
     <div class="flex items-end gap-2">
       <!-- 시간/읽음상태 (왼쪽) -->
       <div class="flex flex-col items-end text-xs text-gray-400 gap-0.5 mb-1">
         ${!data.is_read ? '<span class="unread-label">안읽음</span>' : ''}
         <span>${new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
       </div>
       
       <!-- 말풍선 (오른쪽) -->
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
   // 상대방 메시지: 시간/읽음상태가 말풍선 오른쪽에 (닉네임 제거)
   messageContainer.innerHTML = `
     <div class="flex items-end gap-2">
       <!-- 말풍선 (왼쪽) -->
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
       
       <!-- 시간 (오른쪽) -->
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

// 읽음 처리 관련 핸들러들
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

// 🔥 수정된 handleTradeCompleted (양쪽 모두 완료)
export function handleTradeCompleted(data) {
  updateSensitiveInfoCards();
  updateUIAfterTradeComplete(true);
  
  // 🔥 NEW: 구매자인 경우 즉시 리뷰 모달 표시
  const currentUser = window.currentUser || '';
  const roomBuyer = window.roomBuyer || '';
  const isBuyer = currentUser === roomBuyer;
  
  if (isBuyer) {
    // 이미 리뷰를 작성했는지 확인
    const hasAlreadyReviewed = window.hasAlreadyReviewed || false;
    if (!hasAlreadyReviewed) {
      setTimeout(() => {
        showReviewRedirectModal();
      }, 1000); // 1초 후 표시 (완료 처리 완료 후)
    }
  }
}

// 🔥 NEW: 거래 진행 알림 핸들러 (한쪽만 완료)
export function handleTradeProgressNotification(data) {
  const currentUser = window.currentUser || '';
  const roomBuyer = window.roomBuyer || '';
  const isBuyer = currentUser === roomBuyer;
  const completedBy = data.completed_by; // 'buyer' 또는 'seller'
  const completedUser = data.completed_user;
  const otherUser = data.other_user;
  
  if (completedBy === 'buyer') {
    // 구매자가 먼저 완료한 경우
    if (isBuyer) {
      // 구매자 본인 - 판매자 완료 대기 메시지
      showToast('거래완료 요청을 보냈습니다. 판매자의 확인을 기다려주세요.', 'success');
    } else {
      // 판매자 - 구매자 완료 알림
      showToast(`${completedUser}님이 거래완료를 요청했습니다. 확인 후 거래완료 버튼을 눌러주세요.`, 'info');
    }
  } else if (completedBy === 'seller') {
    // 판매자가 먼저 완료한 경우
    if (isBuyer) {
      // 구매자 - 판매자 완료 알림
      showToast(`${completedUser}님이 거래완료 처리했습니다. 상품 확인 후 거래완료 버튼을 눌러주세요.`, 'info');
    } else {
      // 판매자 본인 - 구매자 완료 대기 메시지
      showToast('거래완료 처리되었습니다. 구매자의 확인을 기다려주세요.', 'success');
    }
  }
  
  // UI 상태 업데이트 (헤더의 상태 텍스트 등)
  updateTradeProgressUI(completedBy, currentUser);
}

// 🔥 NEW: 거래 진행 상태 UI 업데이트
function updateTradeProgressUI(completedBy, currentUser) {
  const tradeStatusContainer = document.getElementById('tradeStatusContainer');
  const roomBuyer = window.roomBuyer || '';
  const isBuyer = currentUser === roomBuyer;
  
  if (tradeStatusContainer) {
    const desktopStatus = tradeStatusContainer.querySelector('.desktop-only .status-text');
    const mobileStatus = tradeStatusContainer.querySelector('.mobile-only .status-text');
    
    let statusText = '';
    let statusClass = 'waiting bg-purple-100 text-purple-800';
    
    if (completedBy === 'buyer' && !isBuyer) {
      // 구매자 완료, 현재 사용자는 판매자
      statusText = '거래완료 버튼을 눌러주세요';
      statusClass = 'pending bg-yellow-100 text-yellow-800';
    } else if (completedBy === 'seller' && isBuyer) {
      // 판매자 완료, 현재 사용자는 구매자
      statusText = '거래완료 버튼을 눌러주세요';
      statusClass = 'pending bg-yellow-100 text-yellow-800';
    } else {
      // 본인이 완료한 경우
      statusText = '상대방의 완료를 기다리는 중';
      statusClass = 'waiting bg-purple-100 text-purple-800';
    }
    
    if (desktopStatus) {
      desktopStatus.className = `status-text text-xs px-2 py-1 rounded font-medium whitespace-nowrap ${statusClass}`;
      desktopStatus.textContent = statusText;
    }
    
    if (mobileStatus) {
      mobileStatus.className = `status-text text-xs px-2 py-1 rounded font-medium whitespace-nowrap ${statusClass}`;
      mobileStatus.textContent = statusText;
    }
  }
}

// 🔥 NEW: 리뷰 페이지 이동 모달 표시
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
        // 리뷰 작성 페이지로 이동
        const otherUser = window.roomSeller || getOtherUserFromHeader();
        if (otherUser) {
          window.location.href = `/accounts/write-review/${otherUser}/?room_code=${window.roomCode}`;
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

// 🔥 NEW: 헤더에서 상대방 사용자명 추출
function getOtherUserFromHeader() {
  const userNameElement = document.querySelector('.bg-gray-50 h2.font-semibold');
  if (userNameElement) {
    return userNameElement.textContent.trim();
  }
  return null;
}

// 거래 상태 업데이트 핸들러 (게시글에서 거래완료 시)
export function handleTradeStatusUpdate(data) {
  if (data.post_marked_sold && data.seller_completed) {
    // 게시글에서 거래완료가 되어 채팅방의 seller_completed가 True가 된 경우
    showToast('게시글이 거래완료 처리되었습니다.', 'info');
    
    // UI 업데이트
    updateTradeStatusUI();
    
    // 1-2초 후 페이지 새로고침으로 최신 상태 반영
    setTimeout(() => {
      location.reload();
    }, 1500);
  }
}

// 거래 상태 UI 업데이트 함수
function updateTradeStatusUI() {
  const tradeStatusContainer = document.getElementById('tradeStatusContainer');
  
  if (tradeStatusContainer) {
    // 데스크탑/모바일 모두 업데이트
    const desktopStatus = tradeStatusContainer.querySelector('.desktop-only .status-text');
    const mobileStatus = tradeStatusContainer.querySelector('.mobile-only .status-text');
    
    if (desktopStatus) {
      desktopStatus.className = 'status-text text-xs px-2 py-1 rounded font-medium whitespace-nowrap completed bg-green-100 text-green-800';
      desktopStatus.textContent = '거래 완료됨';
    }
    
    if (mobileStatus) {
      mobileStatus.className = 'status-text text-xs px-2 py-1 rounded font-medium whitespace-nowrap completed bg-green-100 text-green-800';
      mobileStatus.textContent = '거래 완료됨';
    }
    
    // 거래완료 버튼들 숨기기
    const completeButtons = document.querySelectorAll('#completeTradeBtn, #mobileCompleteTradeBtn');
    completeButtons.forEach(btn => {
      if (btn) btn.style.display = 'none';
    });
  }
}

export function handleTradeCancelNotification(data) {
  const action = data.action;
  const currentUser = window.currentUser || '';
  
  // 액션별 메시지 처리
  switch (action) {
    case 'request':
      showToast('상대방이 거래 취소를 요청했습니다.', 'info');
      break;
    case 'cancelled':
      showToast('거래가 취소되었습니다.', 'error');
      updateUIAfterTradeCancel();
      break;
    case 'rejected':
      showToast('거래 취소 요청이 거절되었습니다. 거래가 계속 진행됩니다.', 'info');
      break;
    case 'withdrawn':
      showToast('상대방이 거래 취소 요청을 철회했습니다.', 'info');
      break;
    default:
      console.log('알 수 없는 취소 액션:', action);
  }
  
  // UI 업데이트 (헤더 새로고침)
  setTimeout(() => {
    location.reload(); // 간단한 방법으로 페이지 새로고침
  }, 2000);
}

// 거래 취소 후 UI 업데이트
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

// 전역 함수로 노출
window.showReviewRedirectModal = showReviewRedirectModal;