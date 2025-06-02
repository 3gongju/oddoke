// static/js/ui-components.js

// 위치 권한 요청 모달
function showLocationModal() {
    const modal = document.getElementById('locationModal');
    modal.style.display = 'flex';
    
    document.getElementById('allowLocationBtn').addEventListener('click', () => {
        modal.style.display = 'none';
        getUserLocation();
        localStorage.removeItem('locationDenied');
    });
    
    document.getElementById('denyLocationBtn').addEventListener('click', () => {
        modal.style.display = 'none';
        initMap();
        localStorage.setItem('locationDenied', 'true');
    });
}

// 카페 상세 모달
function showCafeModal(cafe) {
    const modal = document.getElementById('cafeModal');
    const title = document.getElementById('cafeModalTitle');
    const content = document.getElementById('cafeModalContent');
    
    title.textContent = cafe.name;
    
    const distance = userLocation ? 
        calculateDistance(userLocation.lat, userLocation.lng, cafe.latitude, cafe.longitude) : null;
    
    content.innerHTML = `
        <div class="space-y-3 sm:space-y-4">
            ${cafe.main_image ? `
                <img src="${cafe.main_image}" alt="${cafe.name}" class="w-full h-32 sm:h-40 object-cover rounded-lg">
            ` : `
                <div class="w-full h-32 sm:h-40 bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg flex items-center justify-center">
                    <span class="text-pink-400 text-4xl">🏪</span>
                </div>
            `}
            
            <div class="bg-gray-50 p-3 rounded-lg">
                <div class="flex items-center justify-between mb-2">
                    <h4 class="font-semibold text-gray-900 text-sm sm:text-base">${cafe.artist}${cafe.member ? ' - ' + cafe.member : ''}</h4>
                    ${cafe.is_active ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">운영중</span>' : '<span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">종료</span>'}
                </div>
                <p class="text-sm text-gray-600 mb-1">📅 ${cafe.start_date} ~ ${cafe.end_date}</p>
                ${distance ? `<p class="text-sm text-blue-600">📍 내 위치에서 ${distance.toFixed(1)}km</p>` : ''}
            </div>
            
            <div>
                <h5 class="font-medium text-gray-800 mb-2 text-sm flex items-center">
                    <span class="mr-2">📍</span> 위치
                </h5>
                <p class="text-sm text-gray-600 bg-gray-50 p-2 rounded">${cafe.address}</p>
            </div>
            
            ${cafe.special_benefits ? `
            <div>
                <h5 class="font-medium text-gray-800 mb-2 text-sm flex items-center">
                    <span class="mr-2">🎁</span> 특전
                </h5>
                <p class="text-sm text-gray-600 bg-yellow-50 p-2 rounded">${cafe.special_benefits}</p>
            </div>
            ` : ''}
            
            <div class="flex space-x-2 pt-2 sm:pt-4 border-t">
                <a href="/ddoksang/detail/${cafe.id}/" class="flex-1 bg-gray-900 text-white py-2.5 text-center rounded-lg hover:bg-gray-800 text-sm font-medium transition-colors">
                    자세히 보기
                </a>
                <button onclick="moveToLocation(${cafe.latitude}, ${cafe.longitude})" class="px-3 sm:px-4 py-2.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium transition-colors">
                    📍 위치
                </button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

// 모달 닫기
function closeCafeModal() {
    document.getElementById('cafeModal').classList.add('hidden');
}

// 찜한 아티스트 카로셀
function initFavoriteCarousel() {
    const carousel = document.getElementById('favoriteCarousel');
    if (!carousel) return;
    
    let isDown = false;
    let startX;
    let scrollLeft;

    // 마우스 이벤트
    carousel.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - carousel.offsetLeft;
        scrollLeft = carousel.scrollLeft;
        carousel.style.cursor = 'grabbing';
        e.preventDefault();
    });

    carousel.addEventListener('mouseleave', () => {
        isDown = false;
        carousel.style.cursor = 'grab';
    });

    carousel.addEventListener('mouseup', () => {
        isDown = false;
        carousel.style.cursor = 'grab';
    });

    carousel.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - carousel.offsetLeft;
        const walk = (x - startX) * 2;
        carousel.scrollLeft = scrollLeft - walk;
    });

    // 터치 이벤트
    carousel.addEventListener('touchstart', (e) => {
        isDown = true;
        startX = e.touches[0].pageX - carousel.offsetLeft;
        scrollLeft = carousel.scrollLeft;
    });

    carousel.addEventListener('touchmove', (e) => {
        if (!isDown) return;
        const x = e.touches[0].pageX - carousel.offsetLeft;
        const walk = (x - startX) * 2;
        carousel.scrollLeft = scrollLeft - walk;
    });

    carousel.addEventListener('touchend', () => {
        isDown = false;
    });
}

// 생일 아티스트 슬라이더
function initBirthdayNavigation() {
    const slider = document.getElementById('birthdaySlider');
    const prevBtn = document.getElementById('birthdayPrevBtn');
    const nextBtn = document.getElementById('birthdayNextBtn');
    const indicatorsContainer = document.getElementById('birthdayIndicators');
    
    if (!slider || !prevBtn || !nextBtn) return;
    
    const cards = slider.children;
    const totalCards = cards.length;
    
    function getVisibleCards() {
        if (window.innerWidth >= 1280) return 5;
        if (window.innerWidth >= 1024) return 4;
        if (window.innerWidth >= 768) return 3;
        if (window.innerWidth >= 640) return 2;
        return 1;
    }
    
    let currentIndex = 0;
    let visibleCards = getVisibleCards();
    const maxIndex = Math.max(0, totalCards - visibleCards);
    
    function createIndicators() {
        indicatorsContainer.innerHTML = '';
        const totalPages = Math.ceil(totalCards / visibleCards);
        
        for (let i = 0; i < totalPages; i++) {
            const dot = document.createElement('button');
            dot.className = `w-2 h-2 rounded-full transition-colors ${i === Math.floor(currentIndex / visibleCards) ? 'bg-gray-600' : 'bg-gray-300'}`;
            dot.addEventListener('click', () => goToPage(i));
            indicatorsContainer.appendChild(dot);
        }
    }
    
    function goToPage(pageIndex) {
        currentIndex = Math.min(pageIndex * visibleCards, maxIndex);
        updateSlider();
    }
    
    function updateSlider() {
        const translateX = -(currentIndex * (100 / visibleCards));
        slider.style.transform = `translateX(${translateX}%)`;
        
        prevBtn.disabled = currentIndex <= 0;
        nextBtn.disabled = currentIndex >= maxIndex;
        
        updateIndicators();
    }
    
    function updateIndicators() {
        const dots = indicatorsContainer.children;
        const currentPage = Math.floor(currentIndex / visibleCards);
        
        for (let i = 0; i < dots.length; i++) {
            dots[i].className = `w-2 h-2 rounded-full transition-colors ${i === currentPage ? 'bg-gray-600' : 'bg-gray-300'}`;
        }
    }
    
    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex = Math.max(0, currentIndex - visibleCards);
            updateSlider();
        }
    });
    
    nextBtn.addEventListener('click', () => {
        if (currentIndex < maxIndex) {
            currentIndex = Math.min(maxIndex, currentIndex + visibleCards);
            updateSlider();
        }
    });
    
    function handleResize() {
        const newVisibleCards = getVisibleCards();
        if (newVisibleCards !== visibleCards) {
            visibleCards = newVisibleCards;
            currentIndex = Math.min(currentIndex, Math.max(0, totalCards - visibleCards));
            createIndicators();
            updateSlider();
        }
    }
    
    createIndicators();
    updateSlider();
    
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleResize, 250);
    });
}

// 아티스트 검색
function searchArtist(artistName) {
    window.location.href = `/ddoksang/search/?q=${encodeURIComponent(artistName)}`;
}

// 전역 함수로 설정
window.closeCafeModal = closeCafeModal;
window.searchArtist = searchArtist;