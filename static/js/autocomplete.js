// 확인 필요 (artist_autocomplete.js) 랑 차이 / 어디서 받아 쓰는지

// 재사용 가능한 자동완성 함수
function initAutocomplete(inputId, listId, options = {}) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  
  if (!input || !list) {
    console.error('자동완성: 입력창 또는 목록 요소를 찾을 수 없습니다.');
    return;
  }

  // 기존 이벤트 리스너 제거 (중복 방지)
  if (input._autocompleteInit) {
    return;
  }
  input._autocompleteInit = true;

  let selectedIndex = -1;
  let currentResults = [];
  let searchTimeout = null; // 디바운스용
  
  // 기본 옵션
  const defaultOptions = {
    showBirthday: false,
    showArtistTag: true,
    onSelect: null,
    submitOnSelect: true,
    artistOnly: false,
    apiUrl: '/artist/autocomplete/'
  };
  
  const config = { ...defaultOptions, ...options };
  
  // artistOnly가 true면 아티스트 전용 API 사용
  if (config.artistOnly) {
    config.apiUrl = '/artist/artist-autocomplete/';
  }

  input.addEventListener('input', function () {
    const keyword = this.value.trim();
    selectedIndex = -1;
    
    // 이전 타이머 취소
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    if (!keyword) {
      list.classList.add('hidden');
      list.innerHTML = '';
      currentResults = [];
      return;
    }

    // 300ms 후에 검색 (디바운스)
    searchTimeout = setTimeout(() => {
      fetch(`${config.apiUrl}?q=${encodeURIComponent(keyword)}`)
        .then(res => res.json())
        .then(data => {
          // 현재 입력값과 다르면 무시 (이전 요청 결과 방지)
          if (input.value.trim() !== keyword) {
            return;
          }
          
          list.innerHTML = '';
          currentResults = data.results || [];
          
          if (!currentResults.length) {
            list.classList.add('hidden');
            return;
          }

          // 정확한 매치를 맨 위로 정렬
          currentResults.sort((a, b) => {
            const searchTerm = keyword.toLowerCase();
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            
            // 정확히 일치하는 것이 가장 우선
            const aExact = aName === searchTerm;
            const bExact = bName === searchTerm;
            
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            
            // 시작하는 것이 다음 우선
            const aStarts = aName.startsWith(searchTerm);
            const bStarts = bName.startsWith(searchTerm);
            
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            
            // 그 외에는 알파벳 순서
            return aName.localeCompare(bName);
          });

        currentResults.forEach((result, index) => {
          const item = document.createElement('li');
          item.className = 'px-4 py-3 hover:bg-yellow-100 cursor-pointer text-sm border-b border-gray-100 last:border-b-0';
          item.setAttribute('data-index', index);
          
          let htmlContent = '';
          
          if (result.type === 'artist') {
            htmlContent = `
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  ${config.showArtistTag ? '<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2">아티스트</span>' : ''}
                  <span class="font-medium">${result.name}</span>
                </div>
              </div>
            `;
          } else if (result.type === 'member') {
            htmlContent = `
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  ${config.showArtistTag ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded mr-2">멤버</span>' : ''}
                  <div>
                    <div class="font-medium">${result.name}</div>
                    <div class="text-xs text-gray-500">${result.artist}</div>
                  </div>
                </div>
                ${config.showBirthday && result.birthday ? `<div class="text-xs text-blue-600 font-medium">${formatBirthday(result.birthday)}</div>` : ''}
              </div>
            `;
          }
          
          item.innerHTML = htmlContent;
          
          item.onclick = () => {
            input.value = result.name;
            list.classList.add('hidden');
            selectedIndex = -1;
            
            if (config.onSelect) {
              config.onSelect(result, input);
            }
            
            if (config.submitOnSelect && input.form) {
              input.form.submit();
            }
          };
          
          list.appendChild(item);
        });

        list.classList.remove('hidden');
      })
      .catch(error => {
        console.error('자동완성 오류:', error);
        list.classList.add('hidden');
      });
    }, 300); // 300ms 디바운스
  });

  // 키보드 네비게이션 (하이라이트 없이 값만 변경)
  input.addEventListener('keydown', function (e) {
    const items = list.querySelectorAll('li');
    if (!items.length) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      
      // 인덱스 증가 (첫 번째 호출에서 -1 → 0)
      if (selectedIndex === -1) {
        selectedIndex = 0;
      } else {
        selectedIndex = selectedIndex < items.length - 1 ? selectedIndex + 1 : 0;
      }
      
      // 값만 변경 (하이라이트 없음)
      if (currentResults[selectedIndex]) {
        input.value = currentResults[selectedIndex].name;
      }
      
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      
      if (selectedIndex <= 0) {
        selectedIndex = -1;
      } else {
        selectedIndex = selectedIndex - 1;
        if (currentResults[selectedIndex]) {
          input.value = currentResults[selectedIndex].name;
        }
      }
      
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && items[selectedIndex]) {
        e.preventDefault();
        items[selectedIndex].click();
      }
    } else if (e.key === 'Escape') {
      list.classList.add('hidden');
      selectedIndex = -1;
    }
  });

  // 외부 클릭 시 드롭다운 닫기
  document.addEventListener('click', e => {
    if (!list.contains(e.target) && e.target !== input) {
      list.classList.add('hidden');
      selectedIndex = -1;
    }
  });
}

// 생일 포맷팅 함수
function formatBirthday(birthday) {
  if (!birthday) return '';
  
  const date = new Date(birthday);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}