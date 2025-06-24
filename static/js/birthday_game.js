// birthday_game.js - 생일시 맞추기 게임 전용 JavaScript

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
  if (!gameDOM.container) return; // 게임 컨테이너가 없으면 종료
  
  gameDOM.container.classList.remove('hidden');
  gameDOM.memberSelectionView.classList.remove('hidden');
  gameDOM.gameView.classList.add('hidden');
  gameDOM.noBirthdayView.classList.add('hidden');
  
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
    
    memberItem.addEventListener('click', () => selectMember(member));
    gameDOM.memberGrid.appendChild(memberItem);
  });
}

function showNoBirthdayMessage() {
  if (!gameDOM.container) return; // 게임 컨테이너가 없으면 종료
  
  gameDOM.container.classList.remove('hidden');
  gameDOM.memberSelectionView.classList.add('hidden');
  gameDOM.gameView.classList.add('hidden');
  gameDOM.noBirthdayView.classList.remove('hidden');
}

function selectMember(member) {
  gameData.selectedMember = member;
  
  // === 실제 생일시 계산 로직 ===
  const birthMonth = member.birth_month; // 생월 (1-12)
  const birthDay = member.birth_day;     // 생일 (1-31)
  
  // 현재 시간 기준으로 가능한 두 시간대 계산
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // 오전 시간대: 생월을 시간으로, 생일을 분으로
  const morningHour = Math.max(0, Math.min(23, birthMonth)); // 1-12월 → 1-12시
  const targetMinute = Math.max(0, Math.min(59, birthDay));  // 1-31일 → 1-31분 (59분 넘으면 59분으로)
  
  // 오후 시간대: 생월 + 12시간
  const eveningHour = Math.max(0, Math.min(23, birthMonth + 12)); // 13-24시 (24시는 0시로 처리)
  
  // 현재 시간과 가까운 시간대 선택
  const morningTime = new Date();
  morningTime.setHours(morningHour, targetMinute, 0, 0);
  
  const eveningTime = new Date();
  eveningTime.setHours(eveningHour, targetMinute, 0, 0);
  
  // 현재 시간과의 차이를 계산하여 더 가까운 시간 선택
  const morningDiff = Math.abs(now.getTime() - morningTime.getTime());
  const eveningDiff = Math.abs(now.getTime() - eveningTime.getTime());
  
  // 더 가까운 시간을 목표 시간으로 설정
  if (morningDiff <= eveningDiff) {
    gameData.targetTime = morningTime;
    console.log(`🎯 오전 시간대 선택: ${morningHour}:${targetMinute} (생월: ${birthMonth}, 생일: ${birthDay})`);
  } else {
    gameData.targetTime = eveningTime;
    console.log(`🎯 오후 시간대 선택: ${eveningHour}:${targetMinute} (생월: ${birthMonth}, 생일: ${birthDay})`);
  }
  
  // === 테스트용 코드 (필요시 주석 해제) ===
  /*
  // 테스트용: 현재 시간에서 5초 후로 설정
  gameData.targetTime = new Date();
  gameData.targetTime.setSeconds(gameData.targetTime.getSeconds() + 5);
  console.log('🎯 테스트 모드: 5초 후 시간으로 설정');
  */
  
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
  
  // 목표 시간 표시 및 호버/클릭 기능 추가
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
  
  // 오전/오후 시간 계산
  const morningTime = new Date();
  morningTime.setHours(Math.max(0, Math.min(23, birthMonth)), Math.max(0, Math.min(59, birthDay)), 0, 0);
  
  const eveningTime = new Date();
  eveningTime.setHours(Math.max(0, Math.min(23, birthMonth + 12)), Math.max(0, Math.min(59, birthDay)), 0, 0);
  
  // 현재 선택된 시간과 반대 시간 계산
  const currentTargetFormatted = formatTargetTime(gameData.targetTime);
  const currentHour = gameData.targetTime.getHours();
  
  let alternativeTime, alternativeMessage;
  if (currentHour < 12) {
    // 현재 오전이면 오후 시간을 대안으로
    alternativeTime = eveningTime;
    alternativeMessage = `오후 ${formatTargetTime(eveningTime)}에 재도전할 수 있어요!`;
  } else {
    // 현재 오후면 오전 시간을 대안으로
    alternativeTime = morningTime;
    alternativeMessage = `오전 ${formatTargetTime(morningTime)}에 재도전할 수 있어요!`;
  }
  
  // 목표 시간 요소에 텍스트 설정
  gameDOM.targetTime.textContent = currentTargetFormatted;
  gameDOM.targetTime.style.cursor = 'pointer';
  gameDOM.targetTime.style.position = 'relative';
  
  // 기존 이벤트 제거 후 새로 추가
  const newTargetTimeElement = gameDOM.targetTime.cloneNode(true);
  gameDOM.targetTime.parentNode.replaceChild(newTargetTimeElement, gameDOM.targetTime);
  gameDOM.targetTime = newTargetTimeElement; // DOM 참조 업데이트
  
  // 팝업 툴팁 생성 함수
  function createTooltip() {
    // 기존 툴팁 제거
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
      background: #1f2937;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
      white-space: nowrap;
      z-index: 1000;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      animation: tooltipFadeIn 0.2s ease-out;
    `;
    
    // 말풍선 꼬리 추가
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
      border-top: 6px solid #1f2937;
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
    
    // 3초 후 자동으로 툴팁 제거
    setTimeout(() => {
      if (tooltip && tooltip.parentNode) {
        tooltip.remove();
      }
    }, 3000);
  });
  
  // 다른 곳 클릭 시 툴팁 제거
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
  // 시간 차이에 따른 점수 계산
  if (timeDiff < 50) return 1000; // PERFECT
  if (timeDiff < 200) return 500;  // 성공
  if (timeDiff < 500) return 200;  // 준수
  if (timeDiff < 1000) return 100; // 아쉬움
  return 0; // 실패
}

function showResult(timeDiff, ddok) {
  gameDOM.resultContainer.innerHTML = '';
  const diffSeconds = (timeDiff / 1000).toFixed(3);
  const resultEl = document.createElement('div');
  resultEl.className = 'result-popup';
  
  if (timeDiff < 50) {
    resultEl.textContent = `PERFECT! (+${ddok.toLocaleString()}똑)`;
    resultEl.className += ' text-pink-400';
  } else if (timeDiff < 200) {
    resultEl.textContent = `덕이 쌓입니다! (+${ddok.toLocaleString()}똑)`;
    resultEl.className += ' text-white';
  } else if (timeDiff < 500) {
    resultEl.textContent = `${diffSeconds}초 차이! (+${ddok.toLocaleString()}똑)`;
    resultEl.className += ' text-gray-300';
  } else if (timeDiff < 1000) {
    resultEl.textContent = `아쉽지만 덕을 쌓을 정도는 아니네요... (+${ddok.toLocaleString()}똑)`;
    resultEl.className += ' text-gray-400';
  } else {
    resultEl.textContent = `덕 못 쌓음... (+0덕)`;
    resultEl.className += ' text-gray-500';
  }
  
  gameDOM.resultContainer.appendChild(resultEl);
}

async function savePoints(points, memberId, savePointsApiUrl) {
  if (!csrftoken) {
    console.error('CSRF 토큰을 찾을 수 없습니다.');
    return;
  }
  try {
    console.log('포인트 저장 시도:', points, memberId, savePointsApiUrl);
    const response = await fetch(savePointsApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrftoken,
      },
      body: JSON.stringify({
        points: points,
        member_id: memberId,
      }),
    });
    const data = await response.json();
    if (response.ok) {
      console.log('포인트 저장 성공:', data.message);
    } else {
      console.error('포인트 저장 실패:', data.message);
    }
  } catch (error) {
    console.error('포인트 저장 중 네트워크 오류 발생:', error);
  }
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
  // DOM 요소들 다시 할당 (페이지가 완전히 로드된 후)
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

  // 게임 컨테이너가 없으면 게임 기능 비활성화
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
        // 새로운 API 엔드포인트 사용
        saveBirthdayDdokPoints(ddok, gameData.selectedMember.id, timeDiff);
      }
      
      // 버튼 클릭 효과
      this.classList.add('button-click-effect');
      setTimeout(() => this.classList.remove('button-click-effect'), 100);
    });
  }
  
  // 다른 멤버 선택 버튼
  if (gameDOM.backButton) {
    gameDOM.backButton.addEventListener('click', backToSelection);
  }

  // 게임 섹션 초기 표시
  showBirthdayGameSection(todayBirthdaysApiUrl);
}

// === 덕 포인트 저장 함수 ===
async function saveBirthdayDdokPoints(ddok_points, memberId, timeDifference) {
  console.log('🎯 saveBirthdayDdokPoints 함수 호출됨');
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
    
    console.log('🎯 응답 상태:', response.status);
    console.log('🎯 응답 URL:', response.url);
    
    if (!response.ok) {
      console.error('❌ HTTP 에러:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('🎯 응답 데이터:', data);
    
    if (data.success) {
      console.log('✅ 덕 포인트 저장 성공:', data.message);
      console.log(`획득한 덕: ${data.ddok_points_earned}덕`);
      console.log(`총 덕: ${data.total_ddok_points}덕`);
      
      // 게임 화면에 총 덕 포인트 업데이트 표시
      if (gameDOM.totalScore) {
        gameDOM.totalScore.textContent = data.total_ddok_points.toLocaleString();
      }
    } else {
      console.error('❌ 덕 포인트 저장 실패:', data.error);
    }
  } catch (error) {
    console.error('❌ 덕 포인트 저장 네트워크 오류:', error);
  }
}

// 전역 스코프에서 함수가 정의되었는지 확인
console.log('🎯 saveBirthdayDdokPoints 함수 정의됨:', typeof saveBirthdayDdokPoints);