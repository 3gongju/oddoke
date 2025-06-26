// 검정/핑크 조합의 깔끔한 생일시 맞추기 게임 JavaScript

let gameData = {
  selectedMember: null,
  targetTime: null,
  totalDdok: 0,
  animationFrameId: null
};

// DOM 요소들
const gameDOM = {
  container: document.getElementById('birthday-game-container'),
  memberSelectionView: document.getElementById('member-selection-view'),
  gameView: document.getElementById('game-view'),
  noBirthdayView: document.getElementById('no-birthday-view'),
  memberGrid: document.getElementById('member-selector-grid'),
  idolImage: document.getElementById('game-idol-image'),
  idolName: document.getElementById('idol-name'),
  idolGroup: document.getElementById('idol-group'),
  targetTime: document.getElementById('target-time'),
  timeMain: document.getElementById('time-main'),
  timeMs: document.getElementById('time-ms'),
  ddokButton: document.getElementById('ddok-button'),
  resultContainer: document.getElementById('result-container'),
  totalScore: document.getElementById('total-score'),
  backButton: document.getElementById('back-to-selection')
};

// CSRF 토큰 가져오기
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}
const csrftoken = getCookie('csrftoken');

// === 게임 관련 함수들 ===
async function loadTodaysBirthdays(apiUrl) {
  try {
    console.log('오늘 생일 API 호출 시작...', apiUrl);
    const response = await fetch(apiUrl);
    console.log('API 응답 상태:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('오늘 생일 데이터:', data);
    return data;
  } catch (error) {
    console.error('오늘 생일 데이터 로드 실패:', error);
    return [];
  }
}

function showBirthdayGameSection(todayBirthdaysApiUrl) {
  console.log('showBirthdayGameSection 호출됨, API URL:', todayBirthdaysApiUrl);
  loadTodaysBirthdays(todayBirthdaysApiUrl).then(todaysBirthdays => {
    console.log('로드된 생일 데이터:', todaysBirthdays);
    console.log('생일 데이터 길이:', todaysBirthdays.length);
    
    if (todaysBirthdays.length > 0) {
      console.log('오늘 생일인 멤버가 있음, 게임 표시');
      showMemberSelection(todaysBirthdays);
    } else {
      console.log('오늘 생일인 멤버가 없음, 메시지 표시');
      showNoBirthdayMessage();
    }
  }).catch(error => {
    console.error('생일 데이터 로드 중 에러:', error);
    showNoBirthdayMessage();
  });
}

function showMemberSelection(members) {
  if (!gameDOM.container) return;
  
  gameDOM.container.classList.remove('hidden');
  gameDOM.memberSelectionView.classList.remove('hidden');
  gameDOM.gameView.classList.add('hidden');
  if (gameDOM.noBirthdayView) gameDOM.noBirthdayView.classList.add('hidden');
  
  gameDOM.memberGrid.innerHTML = '';
  
  // 멤버 수에 따른 그리드 스타일 적용
  gameDOM.memberGrid.setAttribute('data-count', members.length);
  
  members.forEach(member => {
    const memberItem = document.createElement('div');
    memberItem.className = 'member-item';
    memberItem.innerHTML = `
      <img src="${member.image_url || '/static/image/default_member.svg'}" 
           alt="${member.member_name}" 
           class="member-image"
           onerror="this.src='/static/image/default_member.svg'">
      <div class="member-info">
        <h4 class="member-name">${member.member_name}</h4>
        <p class="artist-name">${member.artist_full_name}</p>
      </div>
    `;
    
    memberItem.addEventListener('click', (e) => {
      // 기존 선택 해제
      document.querySelectorAll('.member-item').forEach(item => {
        item.classList.remove('selected');
      });
      
      // 현재 아이템 선택
      memberItem.classList.add('selected');
      
      selectMember(member);
    });
    
    gameDOM.memberGrid.appendChild(memberItem);
  });
}

function showNoBirthdayMessage() {
  if (!gameDOM.container) return;
  
  gameDOM.container.classList.remove('hidden');
  gameDOM.memberSelectionView.classList.add('hidden');
  gameDOM.gameView.classList.add('hidden');
  if (gameDOM.noBirthdayView) gameDOM.noBirthdayView.classList.remove('hidden');
}

function selectMember(member) {
  gameData.selectedMember = member;
  
  // === 실제 생일시 계산 로직 ===
  const birthMonth = member.birth_month;
  const birthDay = member.birth_day;
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  const morningHour = Math.max(0, Math.min(23, birthMonth));
  const targetMinute = Math.max(0, Math.min(59, birthDay));
  const eveningHour = Math.max(0, Math.min(23, birthMonth + 12));
  
  const morningTime = new Date();
  morningTime.setHours(morningHour, targetMinute, 0, 0);
  
  const eveningTime = new Date();
  eveningTime.setHours(eveningHour, targetMinute, 0, 0);
  
  const morningDiff = Math.abs(now.getTime() - morningTime.getTime());
  const eveningDiff = Math.abs(now.getTime() - eveningTime.getTime());
  
  if (morningDiff <= eveningDiff) {
    gameData.targetTime = morningTime;
    console.log(`목표 시간 선택: ${morningHour}:${targetMinute} (생월: ${birthMonth}, 생일: ${birthDay})`);
  } else {
    gameData.targetTime = eveningTime;
    console.log(`목표 시간 선택: ${eveningHour}:${targetMinute} (생월: ${birthMonth}, 생일: ${birthDay})`);
  }
  
  // 테스트용: 현재 시간에서 5초 후로 설정
  gameData.targetTime = new Date();
  gameData.targetTime.setSeconds(gameData.targetTime.getSeconds() + 5);
  console.log('테스트 모드: 5초 후 시간으로 설정');
  
  showGameView();
}

function showGameView() {
  gameDOM.memberSelectionView.classList.add('hidden');
  gameDOM.gameView.classList.remove('hidden');
  
  // 선택된 멤버 정보 표시
  gameDOM.idolImage.src = gameData.selectedMember.image_url || '/static/image/default_member.svg';
  gameDOM.idolImage.onerror = function() {
    this.src = '/static/image/default_member.svg';
  };
  gameDOM.idolName.textContent = gameData.selectedMember.member_name;
  gameDOM.idolGroup.textContent = gameData.selectedMember.artist_full_name;
  
  // 목표 시간 표시
  setupTargetTimeDisplay();
  
  // 시간 루프 시작
  startTimeLoop();
}

function formatTargetTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function setupTargetTimeDisplay() {
  const birthMonth = gameData.selectedMember.birth_month;
  const birthDay = gameData.selectedMember.birth_day;
  
  const morningTime = new Date();
  morningTime.setHours(Math.max(0, Math.min(23, birthMonth)), Math.max(0, Math.min(59, birthDay)), 0, 0);
  
  const eveningTime = new Date();
  eveningTime.setHours(Math.max(0, Math.min(23, birthMonth + 12)), Math.max(0, Math.min(59, birthDay)), 0, 0);
  
  const currentTargetFormatted = formatTargetTime(gameData.targetTime);
  const currentHour = gameData.targetTime.getHours();
  
  let alternativeTime, alternativeMessage;
  if (currentHour < 12) {
    alternativeTime = eveningTime;
    alternativeMessage = `오후 ${formatTargetTime(eveningTime)}에 재도전할 수 있어요!`;
  } else {
    alternativeTime = morningTime;
    alternativeMessage = `오전 ${formatTargetTime(morningTime)}에 재도전할 수 있어요!`;
  }
  
  gameDOM.targetTime.textContent = currentTargetFormatted;
  gameDOM.targetTime.style.cursor = 'pointer';
  gameDOM.targetTime.style.position = 'relative';
  
  // 기존 이벤트 제거 후 새로 추가
  const newTargetTimeElement = gameDOM.targetTime.cloneNode(true);
  gameDOM.targetTime.parentNode.replaceChild(newTargetTimeElement, gameDOM.targetTime);
  gameDOM.targetTime = newTargetTimeElement;
  
  function createTooltip() {
    const existingTooltip = document.querySelector('.target-time-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
    
    const tooltip = document.createElement('div');
    tooltip.className = 'target-time-tooltip';
    tooltip.textContent = alternativeMessage;
    tooltip.style.cssText = `
      position: absolute;
      bottom: 120%;
      left: 50%;
      transform: translateX(-50%);
      background: #1a1a1a;
      color: #ffffff;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 14px;
      white-space: nowrap;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: tooltipFadeIn 0.2s ease-out;
    `;
    
    const arrow = document.createElement('div');
    arrow.style.cssText = `
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 6px solid #1a1a1a;
    `;
    tooltip.appendChild(arrow);
    
    return tooltip;
  }
  
  // 툴팁 애니메이션 CSS 추가
  if (!document.querySelector('#tooltip-animation-style')) {
    const style = document.createElement('style');
    style.id = 'tooltip-animation-style';
    style.textContent = `
      @keyframes tooltipFadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      .target-time-tooltip {
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }
  
  // 웹 호버 이벤트
  gameDOM.targetTime.addEventListener('mouseenter', function() {
    const tooltip = createTooltip();
    this.appendChild(tooltip);
  });
  
  gameDOM.targetTime.addEventListener('mouseleave', function() {
    const tooltip = this.querySelector('.target-time-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  });
  
  // 모바일 클릭 이벤트
  gameDOM.targetTime.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const tooltip = createTooltip();
    this.appendChild(tooltip);
    
    setTimeout(() => {
      if (tooltip && tooltip.parentNode) {
        tooltip.remove();
      }
    }, 3000);
  });
  
  document.addEventListener('click', function(e) {
    if (!gameDOM.targetTime.contains(e.target)) {
      const tooltip = document.querySelector('.target-time-tooltip');
      if (tooltip) {
        tooltip.remove();
      }
    }
  });
}

function startTimeLoop() {
  function updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    
    gameDOM.timeMain.textContent = `${hours}:${minutes}:${seconds}`;
    gameDOM.timeMs.textContent = `.${milliseconds}`;
    
    gameData.animationFrameId = requestAnimationFrame(updateTime);
  }
  updateTime();
}

function calculateScore(timeDiff) {
  if (timeDiff < 50) return 1000;
  if (timeDiff < 200) return 500;
  if (timeDiff < 500) return 200;
  if (timeDiff < 1000) return 100;
  return 0;
}

function showResult(timeDiff, ddok) {
  gameDOM.resultContainer.innerHTML = '';
  const diffSeconds = (timeDiff / 1000).toFixed(3);
  const resultEl = document.createElement('div');
  resultEl.className = 'result-popup';
  
  if (timeDiff < 50) {
    resultEl.textContent = `PERFECT! (+${ddok.toLocaleString()}덕)`;
    resultEl.classList.add('text-green-600');
  } else if (timeDiff < 200) {
    resultEl.textContent = `덕이 쌓입니다! (+${ddok.toLocaleString()}덕)`;
    resultEl.classList.add('text-green-600');
  } else if (timeDiff < 500) {
    resultEl.textContent = `${diffSeconds}초 차이! (+${ddok.toLocaleString()}덕)`;
    resultEl.classList.add('text-yellow-600');
  } else if (timeDiff < 1000) {
    resultEl.textContent = `아쉽지만... (+${ddok.toLocaleString()}덕)`;
    resultEl.classList.add('text-yellow-600');
  } else {
    resultEl.textContent = `덕 못 쌓음... (+0덕)`;
    resultEl.classList.add('text-red-600');
  }
  
  gameDOM.resultContainer.appendChild(resultEl);
}

function backToSelection() {
  gameDOM.gameView.classList.add('hidden');
  gameDOM.memberSelectionView.classList.remove('hidden');
  
  // 시간 루프 중지
  if (gameData.animationFrameId) {
    cancelAnimationFrame(gameData.animationFrameId);
    gameData.animationFrameId = null;
  }
  
  // 선택 상태 초기화
  document.querySelectorAll('.member-item').forEach(item => {
    item.classList.remove('selected');
  });
}

// === 게임 초기화 함수 ===
function initializeBirthdayGame(todayBirthdaysApiUrl, savePointsApiUrl) {
  // DOM 요소들 다시 할당
  gameDOM.container = document.getElementById('birthday-game-container');
  gameDOM.memberSelectionView = document.getElementById('member-selection-view');
  gameDOM.gameView = document.getElementById('game-view');
  gameDOM.noBirthdayView = document.getElementById('no-birthday-view');
  gameDOM.memberGrid = document.getElementById('member-selector-grid');
  gameDOM.idolImage = document.getElementById('game-idol-image');
  gameDOM.idolName = document.getElementById('idol-name');
  gameDOM.idolGroup = document.getElementById('idol-group');
  gameDOM.targetTime = document.getElementById('target-time');
  gameDOM.timeMain = document.getElementById('time-main');
  gameDOM.timeMs = document.getElementById('time-ms');
  gameDOM.ddokButton = document.getElementById('ddok-button');
  gameDOM.resultContainer = document.getElementById('result-container');
  gameDOM.totalScore = document.getElementById('total-score');
  gameDOM.backButton = document.getElementById('back-to-selection');

  if (!gameDOM.container) {
    console.log('게임 컨테이너가 없어서 게임 기능을 비활성화합니다.');
    return;
  }

  // 게임 이벤트 리스너들
  if (gameDOM.ddokButton) {
    gameDOM.ddokButton.addEventListener('click', function() {
      if (!gameData.targetTime) return;
      
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - gameData.targetTime.getTime());
      const ddok = calculateScore(timeDiff);
      
      gameData.totalDdok += ddok;
      gameDOM.totalScore.textContent = gameData.totalDdok.toLocaleString();
      
      showResult(timeDiff, ddok);
      
      if (ddok > 0) {
        saveBirthdayDdokPoints(ddok, gameData.selectedMember.id, timeDiff);
      }
      
      // 버튼 클릭 효과
      this.style.transform = 'scale(0.95)';
      setTimeout(() => {
        this.style.transform = '';
      }, 100);
    });
  }
  
  if (gameDOM.backButton) {
    gameDOM.backButton.addEventListener('click', backToSelection);
  }

  showBirthdayGameSection(todayBirthdaysApiUrl);
}

// === 덕 포인트 저장 함수 ===
async function saveBirthdayDdokPoints(ddok_points, memberId, timeDifference) {
  console.log('saveBirthdayDdokPoints 함수 호출됨');
  console.log('파라미터:', { ddok_points, memberId, timeDifference });
  
  try {
    const response = await fetch('/calendar/api/save-birthday-ddok-points/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrftoken,
      },
      body: JSON.stringify({
        points: ddok_points,
        member_id: memberId,
        time_difference: timeDifference
      }),
    });
    
    console.log('응답 상태:', response.status);
    
    if (!response.ok) {
      console.error('HTTP 에러:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('응답 데이터:', data);
    
    if (data.success) {
      console.log('덕 포인트 저장 성공:', data.message);
      console.log(`획득한 덕: ${data.ddok_points_earned}덕`);
      console.log(`총 덕: ${data.total_ddok_points}덕`);
      
      if (gameDOM.totalScore) {
        gameDOM.totalScore.textContent = data.total_ddok_points.toLocaleString();
      }
    } else {
      console.error('덕 포인트 저장 실패:', data.error);
    }
  } catch (error) {
    console.error('덕 포인트 저장 네트워크 오류:', error);
  }
}

console.log('saveBirthdayDdokPoints 함수 정의됨:', typeof saveBirthdayDdokPoints);