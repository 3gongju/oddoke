
export function setupDdoksangCafeAutocomplete() {
  // 카테고리 확인
  const categoryElement = document.getElementById('selected-category');
  const currentCategory = categoryElement?.value;
  
  if (!categoryElement || currentCategory !== 'bdaycafe') {
    return;
  }

  const cafeNameInput = document.getElementById('id_cafe_name');
  if (!cafeNameInput) {
    return;
  }

  // 숨겨진 input 생성/확인
  let linkedCafeIdInput = document.getElementById('id_linked_ddoksang_cafe_id');
  if (!linkedCafeIdInput) {
    linkedCafeIdInput = document.createElement('input');
    linkedCafeIdInput.type = 'hidden';
    linkedCafeIdInput.id = 'id_linked_ddoksang_cafe_id';
    linkedCafeIdInput.name = 'linked_ddoksang_cafe_id';
    cafeNameInput.form.appendChild(linkedCafeIdInput);
  }
  
  // 자동완성 컨테이너 생성
  let autocompleteContainer = document.getElementById('ddoksang-cafe-autocomplete');
  if (!autocompleteContainer) {
    autocompleteContainer = document.createElement('div');
    autocompleteContainer.className = `
      absolute z-50 w-full bg-white border border-gray-300 rounded-lg shadow-lg 
      max-h-60 overflow-y-auto hidden
    `;
    autocompleteContainer.id = 'ddoksang-cafe-autocomplete';
    
    // wrapper 확인/생성
    let wrapper = cafeNameInput.closest('.relative');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'relative';
      cafeNameInput.parentNode.insertBefore(wrapper, cafeNameInput);
      wrapper.appendChild(cafeNameInput);
    }
    wrapper.appendChild(autocompleteContainer);
  }
  
  let debounceTimer;
  let currentFocus = -1;

  function selectCafe(cafeData) {
    // 카페명과 연결 ID 설정
    cafeNameInput.value = cafeData.cafe_name;
    linkedCafeIdInput.value = cafeData.id;
    
    // 자동완성 즉시 숨기기 (강제로)
    autocompleteContainer.style.display = 'none';
    autocompleteContainer.classList.add('hidden');
    autocompleteContainer.innerHTML = '';
    currentFocus = -1;
    
    // 아티스트 자동 선택
    const artistSelect = document.getElementById('id_artist');
    if (cafeData.artist_id && artistSelect) {
      let artistOption = artistSelect.querySelector(`option[value="${cafeData.artist_id}"]`);
      if (!artistOption) {
        artistOption = new Option(cafeData.artist_name, cafeData.artist_id, true, true);
        artistSelect.add(artistOption);
      } else {
        artistSelect.value = cafeData.artist_id;
      }
      
      artistSelect.dispatchEvent(new Event('change'));
      
      // 멤버 선택
      setTimeout(() => {
        if (cafeData.member_id) {
          const memberCheckboxes = document.getElementById('member-checkboxes');
          if (memberCheckboxes) {
            const memberCheckbox = memberCheckboxes.querySelector(`input[value="${cafeData.member_id}"]`);
            if (memberCheckbox) {
              memberCheckbox.checked = true;
            }
          }
        }
      }, 500);
    }
    
    // 선택된 카페 정보 카드 표시
    showSelectedCafeCard(cafeData);
  }

  function showSelectedCafeCard(cafeData) {
    // 기존 선택 카드 제거
    const existingCard = document.getElementById('selected-cafe-card');
    if (existingCard) {
      existingCard.remove();
    }

    // 카페명 입력창의 wrapper 찾기
    const wrapper = cafeNameInput.closest('.relative') || cafeNameInput.parentElement;
    
    // 운영 상태 확인
    let statusInfo = getStatusInfo(cafeData);
    
    // 선택된 카페 카드 생성
    const selectedCard = document.createElement('div');
    selectedCard.id = 'selected-cafe-card';
    selectedCard.className = `
      mt-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 
      rounded-xl p-4 shadow-sm animate-fadeIn
    `;
    
    selectedCard.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex items-center space-x-4 flex-1">
          ${cafeData.main_image ? `
            <div class="flex-shrink-0">
              <img src="${cafeData.main_image}" alt="카페 이미지" 
                   class="w-16 h-16 object-cover rounded-lg border-2 border-white shadow-sm">
            </div>
          ` : ''}
          
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-2 mb-2">
              <span class="inline-flex items-center text-blue-600 text-sm">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"/>
                </svg>
                연결된 덕생 카페
              </span>
              ${statusInfo.badge}
            </div>
            
            <h3 class="font-bold text-gray-900 text-lg truncate">${cafeData.cafe_name}</h3>
            
            <div class="flex items-center space-x-3 mt-1">
              <span class="text-blue-700 font-medium">${cafeData.artist_name}</span>
              ${cafeData.member_name ? `
                <span class="text-blue-600">- ${cafeData.member_name}</span>
              ` : ''}
            </div>
            
            <p class="text-gray-600 text-sm mt-1 truncate">${cafeData.address}</p>
            
            <div class="flex items-center space-x-4 mt-2 text-xs text-gray-500">
              <span class="inline-flex items-center">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/>
                </svg>
                ${cafeData.start_date} ~ ${cafeData.end_date}
              </span>
              ${statusInfo.daysText || ''}
            </div>
          </div>
        </div>
        
        <div class="flex-shrink-0 flex flex-col space-y-2 ml-4">
          <a href="${cafeData.detail_url}" target="_blank" 
             class="inline-flex items-center px-3 py-2 text-xs font-medium text-blue-600 
                    bg-white border border-blue-200 rounded-lg hover:bg-blue-50 
                    transition-colors duration-200">
            <span>(덕)보기</span>
            <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
            </svg>
          </a>
          
          <button type="button" onclick="disconnectDdoksangCafe()" 
                  class="inline-flex items-center px-3 py-2 text-xs font-medium text-gray-600 
                         bg-white border border-gray-200 rounded-lg hover:bg-gray-50 
                         transition-colors duration-200" 
                  title="연결 해제">
            <span>연결 해제</span>
            <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    // 카드를 wrapper 다음에 삽입
    wrapper.parentNode.insertBefore(selectedCard, wrapper.nextSibling);
    
    // 카페명 입력창 스타일 변경 (연결됨을 표시)
    cafeNameInput.className = cafeNameInput.className.replace(/border-gray-300/, 'border-blue-300');
    cafeNameInput.style.backgroundColor = '#f0f9ff'; // blue-50
  }

  function getStatusInfo(cafeData) {
    const today = new Date();
    const startDate = new Date(cafeData.start_date);
    const endDate = new Date(cafeData.end_date);
    
    let badge = '';
    let daysText = '';
    
    if (cafeData.is_active) {
      badge = `
        <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
          <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z"/>
          </svg>
          운영중
        </span>
      `;
      
      const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 7 && daysLeft > 0) {
        daysText = `
          <span class="inline-flex items-center text-xs text-orange-600">
            <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
            </svg>
            ${daysLeft}일 남음
          </span>
        `;
      }
    } else if (startDate > today) {
      badge = `
        <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
          <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
          </svg>
          예정
        </span>
      `;
      
      const daysUntil = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 30) {
        daysText = `
          <span class="inline-flex items-center text-xs text-blue-600">
            <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/>
            </svg>
            ${daysUntil}일 후 시작
          </span>
        `;
      }
    } else {
      badge = `
        <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
          <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"/>
          </svg>
          종료
        </span>
      `;
    }
    
    return { badge, daysText };
  }

  function searchCafes(query) {
    if (query.length < 2) {
      autocompleteContainer.style.display = 'none';
      autocompleteContainer.classList.add('hidden');
      autocompleteContainer.innerHTML = '';
      return;
    }

    const searchUrl = `/ddokdam/ajax/search_ddoksang_cafes/?q=${encodeURIComponent(query)}`;

    fetch(searchUrl)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.cafes && data.cafes.length > 0) {
          displayResults(data.cafes);
        } else {
          autocompleteContainer.style.display = 'none';
          autocompleteContainer.classList.add('hidden');
          autocompleteContainer.innerHTML = '';
        }
      })
      .catch(error => {
        autocompleteContainer.style.display = 'none';
        autocompleteContainer.classList.add('hidden');
        autocompleteContainer.innerHTML = '';
      });
  }

  function displayResults(cafes) {
    autocompleteContainer.innerHTML = '';
    
    cafes.forEach((cafe, index) => {
      const item = document.createElement('div');
      item.className = `
        cafe-item p-4 cursor-pointer hover:bg-blue-50 border-b border-gray-100 
        last:border-b-0 transition-colors duration-150
      `;
      
      // 운영 상태 배지
      let statusBadge = '';
      let statusIcon = '';
      
      if (cafe.is_active) {
        statusBadge = `
          <span class="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
            <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z"/>
            </svg>
            운영중
          </span>
        `;
      } else {
        const today = new Date();
        const startDate = new Date(cafe.start_date);
        if (startDate > today) {
          statusBadge = `
            <span class="inline-flex items-center px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
              </svg>
              예정
            </span>
          `;
        } else {
          statusBadge = `
            <span class="inline-flex items-center px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"/>
              </svg>
              종료
            </span>
          `;
        }
      }
      
      item.innerHTML = `
        <div class="flex items-center space-x-4">
          ${cafe.main_image ? `
            <img src="${cafe.main_image}" alt="카페 이미지" 
                 class="w-12 h-12 object-cover rounded-lg border border-gray-200">
          ` : `
            <div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
              <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z"/>
              </svg>
            </div>
          `}
          
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-3 mb-1">
              <p class="font-semibold text-gray-900 truncate">${cafe.cafe_name}</p>
              ${statusBadge}
            </div>
            
            <div class="flex items-center space-x-2 text-sm text-gray-600 mb-1">
              <span class="font-medium">${cafe.artist_name}</span>
              ${cafe.member_name ? `<span>- ${cafe.member_name}</span>` : ''}
            </div>
            
            <p class="text-xs text-gray-500 truncate">${cafe.address}</p>
            
            <div class="flex items-center space-x-3 mt-1 text-xs text-gray-400">
              <span class="inline-flex items-center">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/>
                </svg>
                ${cafe.start_date} ~ ${cafe.end_date}
              </span>
            </div>
          </div>
          
          <div class="flex-shrink-0">
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </div>
        </div>
      `;
      
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectCafe(cafe);
      });
      autocompleteContainer.appendChild(item);
    });
    
    // 자동완성 창 표시
    autocompleteContainer.style.display = 'block';
    autocompleteContainer.classList.remove('hidden');
    currentFocus = -1;
  }

  // 이벤트 리스너
  cafeNameInput.addEventListener('input', function() {
    // 기존 연결 해제 (새로 입력하면)
    if (linkedCafeIdInput.value) {
      disconnectDdoksangCafe();
    }
    
    const query = this.value.trim();
    
    // 입력이 없으면 자동완성 숨기기
    if (!query) {
      autocompleteContainer.classList.add('hidden');
      autocompleteContainer.innerHTML = '';
      return;
    }
    
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchCafes(query);
    }, 300);
  });

  cafeNameInput.addEventListener('keydown', function(e) {
    const items = autocompleteContainer.querySelectorAll('.cafe-item');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      currentFocus = (currentFocus + 1) % items.length;
      highlightItem(currentFocus);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      currentFocus = (currentFocus - 1 + items.length) % items.length;
      highlightItem(currentFocus);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentFocus > -1 && items[currentFocus]) {
        items[currentFocus].click();
      }
    } else if (e.key === 'Escape') {
      autocompleteContainer.classList.add('hidden');
      autocompleteContainer.innerHTML = '';
      currentFocus = -1;
    }
  });

  function highlightItem(index) {
    const items = autocompleteContainer.querySelectorAll('.cafe-item');
    items.forEach((item, i) => {
      item.classList.toggle('bg-blue-100', i === index);
    });
  }

  // 외부 클릭 시 자동완성 숨기기
  document.addEventListener('click', function(e) {
    const wrapper = cafeNameInput.closest('.relative');
    if (wrapper && !wrapper.contains(e.target) && !autocompleteContainer.contains(e.target)) {
      autocompleteContainer.style.display = 'none';
      autocompleteContainer.classList.add('hidden');
      autocompleteContainer.innerHTML = '';
      currentFocus = -1;
    }
  });
}

// 전역 함수: 덕생 카페 연결 해제
window.disconnectDdoksangCafe = function() {
  const linkedCafeIdInput = document.getElementById('id_linked_ddoksang_cafe_id');
  const selectedCard = document.getElementById('selected-cafe-card');
  const cafeNameInput = document.getElementById('id_cafe_name');
  
  // 연결 ID 초기화
  if (linkedCafeIdInput) {
    linkedCafeIdInput.value = '';
  }
  
  // 선택된 카페 카드 제거
  if (selectedCard) {
    selectedCard.style.opacity = '0';
    selectedCard.style.transform = 'translateY(-10px)';
    setTimeout(() => selectedCard.remove(), 300);
  }
  
  // 카페명 입력창 스타일 원복
  if (cafeNameInput) {
    cafeNameInput.className = cafeNameInput.className.replace(/border-blue-300/, 'border-gray-300');
    cafeNameInput.style.backgroundColor = '';
  }
};

// CSS 애니메이션 추가
if (!document.getElementById('cafe-autocomplete-styles')) {
  const style = document.createElement('style');
  style.id = 'cafe-autocomplete-styles';
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .animate-fadeIn {
      animation: fadeIn 0.3s ease-out;
    }
    
    #selected-cafe-card {
      transition: all 0.3s ease;
    }
  `;
  document.head.appendChild(style);
}