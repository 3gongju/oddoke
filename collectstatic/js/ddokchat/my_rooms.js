// static/js/ddokchat/my_rooms.js

export function setupMyRooms() {
  setupTabSwitcher();
  setupRoomRefresh();
  setupAccessibility();
  setupScrollPosition();
}

function setupTabSwitcher() {
  // 탭 요소들 선택
  const activeTab = document.getElementById('activeTab');
  const completedTab = document.getElementById('completedTab');
  const activeContent = document.getElementById('activeContent');
  const completedContent = document.getElementById('completedContent');
  
  if (!activeTab || !completedTab || !activeContent || !completedContent) {
    console.warn('탭 요소를 찾을 수 없습니다.');
    return;
  }
  
  // 탭 전환 함수
  function switchTab(activeTabEl, activeContentEl, inactiveTabEl, inactiveContentEl) {
    // 탭 버튼 상태 변경
    activeTabEl.classList.add('active');
    inactiveTabEl.classList.remove('active');
    
    // 컨텐츠 표시/숨김
    activeContentEl.classList.add('active');
    inactiveContentEl.classList.remove('active');
    
    // 접근성을 위한 aria 속성 업데이트
    activeTabEl.setAttribute('aria-selected', 'true');
    inactiveTabEl.setAttribute('aria-selected', 'false');
    
    // 로컬 스토리지에 현재 탭 저장 (페이지 새로고침 시 유지)
    const tabName = activeTabEl.id === 'activeTab' ? 'active' : 'completed';
    try {
      localStorage.setItem('selectedChatTab', tabName);
    } catch (e) {
      // localStorage 사용 불가능한 환경에서는 무시
      console.warn('localStorage not available');
    }
  }
  
  // 거래중 탭 클릭 이벤트
  activeTab.addEventListener('click', function(e) {
    e.preventDefault();
    if (!this.classList.contains('active')) {
      switchTab(activeTab, activeContent, completedTab, completedContent);
    }
  });
  
  // 거래완료 탭 클릭 이벤트  
  completedTab.addEventListener('click', function(e) {
    e.preventDefault();
    if (!this.classList.contains('active')) {
      switchTab(completedTab, completedContent, activeTab, activeContent);
    }
  });
  
  // 페이지 로드 시 이전에 선택했던 탭 복원
  try {
    // const savedTab = localStorage.getItem('selectedChatTab');
    // if (savedTab === 'completed') {
    //   switchTab(completedTab, completedContent, activeTab, activeContent);
    // }
  } catch (e) {
    // localStorage 사용 불가능한 환경에서는 기본값 유지
    console.warn('localStorage not available');
  }
}

function setupAccessibility() {
  const activeTab = document.getElementById('activeTab');
  const completedTab = document.getElementById('completedTab');
  const activeContent = document.getElementById('activeContent');
  const completedContent = document.getElementById('completedContent');
  
  // 키보드 접근성 지원
  [activeTab, completedTab].forEach(tab => {
    if (tab) {
      tab.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.click();
        }
      });
      
      // 탭 요소에 role과 tabindex 설정
      tab.setAttribute('role', 'tab');
      tab.setAttribute('tabindex', '0');
    }
  });
  
  // 초기 접근성 속성 설정
  if (activeTab) activeTab.setAttribute('aria-selected', 'true');
  if (completedTab) completedTab.setAttribute('aria-selected', 'false');
  if (activeContent) activeContent.setAttribute('role', 'tabpanel');
  if (completedContent) completedContent.setAttribute('role', 'tabpanel');
}

function setupRoomRefresh() {
  // 채팅방 목록 새로고침 함수
  function refreshChatRooms() {
    // AJAX로 채팅방 목록 업데이트
    fetch(window.location.href, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    .then(response => response.text())
    .then(html => {
      // 새로운 컨텐츠로 업데이트
      const parser = new DOMParser();
      const newDoc = parser.parseFromString(html, 'text/html');
      const newActiveContent = newDoc.getElementById('activeContent');
      const newCompletedContent = newDoc.getElementById('completedContent');
      
      const activeContent = document.getElementById('activeContent');
      const completedContent = document.getElementById('completedContent');
      
      if (newActiveContent && activeContent) {
        activeContent.innerHTML = newActiveContent.innerHTML;
      }
      if (newCompletedContent && completedContent) {
        completedContent.innerHTML = newCompletedContent.innerHTML;
      }
    })
    .catch(error => {
      console.error('채팅방 목록 업데이트 실패:', error);
    });
  }
  
  // 주기적으로 채팅방 목록 업데이트 (30초마다)
  setInterval(refreshChatRooms, 30000);
  
  // 페이지 포커스 시 채팅방 목록 업데이트
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      refreshChatRooms();
    }
  });
  
  // 채팅방 아이템 클릭 시 읽음 표시 처리
  document.addEventListener('click', function(e) {
    const chatItem = e.target.closest('.chatroom-item a');
    if (chatItem) {
      const unreadBadge = chatItem.querySelector('.unread-badge');
      if (unreadBadge) {
        // 읽음 처리 API 호출 (선택사항)
        const roomId = chatItem.href.split('/').pop();
        markAsRead(roomId);
      }
    }
  });
  
  // 읽음 처리 함수
  function markAsRead(roomId) {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
    
    fetch(`/chat/mark-read/${roomId}/`, {
      method: 'POST',
      headers: {
        'X-CSRFToken': csrfToken,
        'Content-Type': 'application/json',
      }
    })
    .catch(error => {
      console.error('읽음 처리 실패:', error);
    });
  }
}

function setupScrollPosition() {
  // 스크롤 위치 복원
  const savedScrollPos = sessionStorage.getItem('chatListScrollPos');
  if (savedScrollPos) {
    window.scrollTo(0, parseInt(savedScrollPos));
    sessionStorage.removeItem('chatListScrollPos');
  }
  
  // 페이지 이동 전 스크롤 위치 저장
  window.addEventListener('beforeunload', function() {
    sessionStorage.setItem('chatListScrollPos', window.scrollY);
  });
}

// 전역 유틸리티 함수들
export const chatRoomUtils = {
  // 특정 채팅방의 읽지 않은 메시지 수 업데이트
  updateUnreadCount: function(roomId, count) {
    const badges = document.querySelectorAll(`[data-room-id="${roomId}"] .unread-badge`);
    badges.forEach(badge => {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    });
  },
  
  // 새 메시지 도착 시 채팅방을 목록 맨 위로 이동
  moveToTop: function(roomId) {
    const activeRoom = document.querySelector(`#activeContent [data-room-id="${roomId}"]`);
    const completedRoom = document.querySelector(`#completedContent [data-room-id="${roomId}"]`);
    
    if (activeRoom) {
      const container = activeRoom.parentElement;
      container.insertBefore(activeRoom, container.firstChild);
      
      // 부드러운 하이라이트 효과
      activeRoom.style.backgroundColor = '#fef3c7';
      setTimeout(() => {
        activeRoom.style.backgroundColor = '';
      }, 2000);
    }
  },
  
  // 채팅방 상태 변경 (거래중 -> 거래완료)
  updateRoomStatus: function(roomId, status) {
    const room = document.querySelector(`[data-room-id="${roomId}"]`);
    if (room) {
      if (status === 'completed') {
        // 거래중에서 거래완료로 이동
        const activeContainer = document.querySelector('#activeContent .space-y-4');
        const completedContainer = document.querySelector('#completedContent .space-y-4');
        
        if (activeContainer && completedContainer) {
          room.classList.add('completed-room');
          completedContainer.appendChild(room);
        }
      }
    }
  }
};

// DOMContentLoaded에서 초기화
document.addEventListener('DOMContentLoaded', function() {
  setupMyRooms();
  
  // 전역으로 노출 (다른 스크립트에서 사용 가능하도록)
  window.chatRoomUtils = chatRoomUtils;
});