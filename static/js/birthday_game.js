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
  
  // === 테스트용 코드 (기존 코드 주석처리) ===
  /*
  const targetHour = member.birth_month + 12;
  const targetMinute = member.birth_day;
  
  gameData.targetTime = new Date();
  gameData.targetTime.setHours(targetHour, targetMinute, 0, 0);
  */
  
  // 테스트용: 현재 시간에서 10초 후로 설정
  gameData.targetTime = new Date();
  gameData.targetTime.setSeconds(gameData.targetTime.getSeconds() + 10);
  
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
  const targetTimeFormatted = formatTargetTime(gameData.targetTime);
  gameDOM.targetTime.textContent = targetTimeFormatted;
  
  // 시간 루프 시작
  startTimeLoop();
}

function formatTargetTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
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
      
      // === 포인트 저장 부분 임시 비활성화 ===
      // if (ddok > 0) {
        // console.log(`포인트 저장 시뮬레이션: ${ddok}점 (멤버ID: ${gameData.selectedMember.id})`);
        // savePoints(ddok, gameData.selectedMember.id, savePointsApiUrl); // 주석처리
      // }

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

