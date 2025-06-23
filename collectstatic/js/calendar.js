// calendar.js - 캘린더 전용 JavaScript

let calendar;

// === 캘린더 관련 함수들 ===
function showMembersPopup(date) {
  const events = calendar.getEvents().filter(event => {
    const eventDate = new Date(event.start);
    return eventDate.toDateString() === date.toDateString();
  });

  if (events.length === 0) return;

  const overlay = document.createElement('div');
  overlay.className = 'member-popup-overlay';
  
  const popup = document.createElement('div');
  popup.className = 'member-popup';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'popup-close';
  closeBtn.innerHTML = '×';
  closeBtn.onclick = function() {
    document.body.removeChild(overlay);
  };
  
  const title = document.createElement('h3');
  title.textContent = `${date.getMonth() + 1}월 ${date.getDate()}일 생일`;
  
  const memberList = document.createElement('div');
  memberList.className = 'member-list';
  
  events.forEach(event => {
    const memberItem = document.createElement('div');
    memberItem.className = 'member-item';
    
    const avatar = document.createElement('img');
    avatar.src = event.extendedProps?.image_url || "/static/image/default_member.svg";
    avatar.alt = event.extendedProps?.member_name || 'Member';
    avatar.onerror = function() {
      this.src = "/static/image/default_member.svg";
    };
    
    const info = document.createElement('div');
    info.innerHTML = `
      <div style="font-weight: bold;">${event.extendedProps?.member_name || '이름없음'}</div>
      <div style="font-size: 0.8rem; color: #6b7280;">${event.extendedProps?.artist_full_name || ''}</div>
    `;
    
    memberItem.appendChild(avatar);
    memberItem.appendChild(info);
    memberList.appendChild(memberItem);
  });
  
  popup.appendChild(closeBtn);
  popup.appendChild(title);
  popup.appendChild(memberList);
  overlay.appendChild(popup);
  
  overlay.onclick = function(e) {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  };
  
  document.body.appendChild(overlay);
}

function groupAndRenderEventsByDate() {
  console.log('groupAndRenderEventsByDate 시작');
  
  // 기존 커스텀 컨테이너들 모두 제거
  document.querySelectorAll('.custom-events-container').forEach(el => el.remove());
  
  // FullCalendar 기본 이벤트 요소들 숨기기
  document.querySelectorAll('.fc-event, .fc-daygrid-event').forEach(el => {
    el.style.display = 'none';
    el.style.visibility = 'hidden';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
  });
  
  const allEvents = calendar.getEvents();
  console.log('전체 이벤트 수:', allEvents.length);
  
  const eventsByDate = {};
  
  // 날짜별로 이벤트 그룹화
  allEvents.forEach(event => {
    const dateKey = event.start.toDateString();
    if (!eventsByDate[dateKey]) {
      eventsByDate[dateKey] = [];
    }
    eventsByDate[dateKey].push(event);
  });
  
  // 각 날짜 셀에 그룹화된 이벤트들 렌더링
  Object.keys(eventsByDate).forEach(dateKey => {
    const events = eventsByDate[dateKey];
    const date = new Date(dateKey);
    
    // 해당 날짜의 셀 찾기
    const dayEl = findDayCellByDate(date);
    if (dayEl && events.length > 0) {
      renderCustomEvents(dayEl, events, date);
      
      // 모바일에서 셀 클릭 이벤트 추가
      if (window.innerWidth <= 768) {
        dayEl.addEventListener('click', function(e) {
          e.preventDefault();
          showMembersPopup(date);
        });
      }
    }
  });
}

function findDayCellByDate(targetDate) {
  const allCells = document.querySelectorAll('.fc-daygrid-day');
  
  for (let cell of allCells) {
    const cellDate = new Date(cell.getAttribute('data-date'));
    if (cellDate.toDateString() === targetDate.toDateString()) {
      return cell.querySelector('.fc-daygrid-day-frame');
    }
  }
  return null;
}

function renderCustomEvents(dayEl, events, date) {
  if (!dayEl || events.length === 0) {
    return;
  }

  // 기존 커스텀 이벤트 컨테이너 제거
  const existingContainer = dayEl.querySelector('.custom-events-container');
  if (existingContainer) {
    existingContainer.remove();
  }

  // 커스텀 이벤트 컨테이너 생성
  const eventsContainer = document.createElement('div');
  eventsContainer.className = 'custom-events-container';
  
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile) {
    // 모바일: 아바타들을 한 줄에 배치 - 날짜와 더 가깝게
    eventsContainer.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 1px;
      margin-top: 16px;
      padding: 0;
      max-height: 40px;
      overflow: hidden;
      position: relative;
      z-index: 1;
      cursor: pointer;
      justify-content: flex-start;
      align-content: flex-start;
      background: transparent !important;
      background-color: transparent !important;
    `;

    const maxVisible = 6;
    const visibleEvents = events.slice(0, maxVisible);
    
    // 아바타들 추가
    visibleEvents.forEach(event => {
      const avatar = document.createElement('img');
      avatar.src = event.extendedProps?.image_url || "/static/image/default_member.svg";
      avatar.alt = event.extendedProps?.member_name || 'Member';
      avatar.className = 'mobile-avatar';
      
      avatar.onerror = function() {
        this.src = "/static/image/default_member.svg";
      };
      
      eventsContainer.appendChild(avatar);
    });

    // 더보기 버튼 추가
    if (events.length > maxVisible) {
      const moreButton = document.createElement('div');
      moreButton.className = 'more-members';
      moreButton.textContent = `+${events.length - maxVisible}`;
      eventsContainer.appendChild(moreButton);
    }

    // 전체 컨테이너 클릭 이벤트
    eventsContainer.addEventListener('click', function(e) {
      e.stopPropagation();
      showMembersPopup(date);
    });

  } else {
    // 데스크톱: 세로로 나열 - 날짜와 더 가깝게
    eventsContainer.style.cssText = `
      margin-top: 1.2rem;
      padding: 0;
      background: transparent !important;
      background-color: transparent !important;
    `;

    events.forEach(event => {
      const eventDiv = document.createElement('div');
      eventDiv.className = 'custom-event-item';

      const avatar = document.createElement('img');
      avatar.src = event.extendedProps?.image_url || "/static/image/default_member.svg";
      avatar.alt = event.extendedProps?.member_name || 'Member';
      avatar.className = 'member-avatar';
      
      avatar.onerror = function() {
        this.src = "/static/image/default_member.svg";
      };

      const textSpan = document.createElement('span');
      textSpan.textContent = event.extendedProps?.member_name || '이름없음';
      textSpan.className = 'member-name';

      eventDiv.appendChild(avatar);
      eventDiv.appendChild(textSpan);
      eventsContainer.appendChild(eventDiv);

      // 데스크톱 툴팁
      const tooltip = document.getElementById('member-tooltip') || createTooltip();
      eventDiv.addEventListener('mouseenter', function(e) {
        if (event.extendedProps?.artist_full_name) {
          tooltip.innerHTML = `<div><strong>${event.extendedProps.member_name}</strong></div><div>${event.extendedProps.artist_full_name}</div>`;
          tooltip.classList.add('show');
          
          const rect = e.target.getBoundingClientRect();
          tooltip.style.left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + 'px';
          tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
        }
      });

      eventDiv.addEventListener('mouseleave', function() {
        tooltip.classList.remove('show');
      });
    });
  }

  dayEl.appendChild(eventsContainer);
}

function createTooltip() {
  let tooltip = document.getElementById('member-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'member-tooltip';
    tooltip.className = 'member-tooltip';
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

// === 캘린더 초기화 함수 ===
function initializeCalendar(eventsApiUrl) {
  console.log('캘린더 초기화 시작, API URL:', eventsApiUrl);
  
  const calendarEl = document.getElementById('calendar');
  const calendarMobileEl = document.getElementById('calendar-mobile');
  const isMobile = window.innerWidth <= 768;
  const targetEl = isMobile ? calendarMobileEl : calendarEl;

  calendar = new FullCalendar.Calendar(targetEl, {
    initialView: 'dayGridMonth',
    locale: 'ko',
    headerToolbar: isMobile ? {
      left: 'prevMobile',
      center: 'title',
      right: 'nextMobile'
    } : {
      left: '',
      center: 'title',
      right: 'today'
    },
    height: 'auto',
    aspectRatio: isMobile ? 1.0 : 1.35,
    nowIndicator: false,
    dayMaxEventRows: false,
    eventDisplay: 'none',
    eventMaxStack: false,
    
    // 날짜 표시 강제 설정
    dayHeaderFormat: {
      weekday: 'short'
    },
    
    // 날짜 셀 내용을 빈 값으로 설정 (기본 요소 생성 방지)
    dayCellContent: function(info) {
      return '';
    },
    
    // 날짜 셀이 렌더링된 후 기본 요소 제거 및 새로 생성
    dayCellDidMount: function(info) {
      // 모든 기본 날짜 번호 요소 제거
      const existingNumbers = info.el.querySelectorAll('.fc-daygrid-day-number');
      existingNumbers.forEach(el => el.remove());
      
      // 새로운 날짜 번호 생성
      const dayFrame = info.el.querySelector('.fc-daygrid-day-frame');
      if (dayFrame) {
        const numberEl = document.createElement('div');
        numberEl.className = 'custom-day-number';
        numberEl.textContent = info.date.getDate();
        dayFrame.insertBefore(numberEl, dayFrame.firstChild);
      }
    },
    
    eventsSet: function(events) {
      console.log('eventsSet 호출됨, 이벤트 수:', events.length);
      
      setTimeout(() => {
        console.log('groupAndRenderEventsByDate 호출 시작');
        if (typeof calendar !== 'undefined' && calendar.getEvents) {
          groupAndRenderEventsByDate();
          // 게임 초기화 함수 호출 (게임 파일이 로드된 경우에만)
          if (typeof showBirthdayGameSection === 'function' && window.API_URLS) {
            showBirthdayGameSection(window.API_URLS.todayBirthdays);
          }
        } else {
          console.error('calendar 객체가 준비되지 않음');
        }
      }, 500);
    },
    
    customButtons: {
      today: {
        text: 'today',
        click: function() {
          calendar.today();
          setTimeout(() => {
            // 게임 섹션 업데이트 (게임 파일이 로드된 경우에만)
            if (typeof showBirthdayGameSection === 'function' && window.API_URLS) {
              showBirthdayGameSection(window.API_URLS.todayBirthdays);
            }
          }, 100);
        }
      },
      prevMobile: {
        text: '‹',
        click: function() {
          calendar.prev();
        }
      },
      nextMobile: {
        text: '›',
        click: function() {
          calendar.next();
        }
      }
    },

    eventDidMount: function(info) {
      info.el.style.display = 'none';
    },

    events: {
      url: eventsApiUrl,
      success: function(data) {
        console.log('=== 캘린더 API 응답 성공 ===');
        console.log('응답 데이터:', data);
      },
      failure: function(error) {
        console.error('=== 캘린더 API 로드 실패 ===', error);
      }
    }
  });

  calendar.render();

  // today 버튼 이벤트 바인딩
  setTimeout(function() {
    const todayButton = document.querySelector('.fc-today-button');
    if (todayButton) {
      todayButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        calendar.today();
      });
    }
  }, 200);

  // 데스크톱용 화살표 버튼 이벤트
  if (!isMobile) {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (prevBtn && nextBtn) {
      prevBtn.addEventListener('click', function() {
        calendar.prev();
      });
      
      nextBtn.addEventListener('click', function() {
        calendar.next();
      });
    }
  }

  // 화면 크기 변경 시 페이지 새로고침으로 처리
  let resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      const nowMobile = window.innerWidth <= 768;
      if (isMobile !== nowMobile) {
        location.reload();
      }
    }, 150);
  });
}