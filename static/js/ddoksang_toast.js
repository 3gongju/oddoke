// static/js/ddoksang_ui_components.js (정리된 버전 - 80줄)
// UI 컴포넌트 관리 (토스트 중복 제거, 간소화)

// ✅ 생일 아티스트 슬라이더 (CSS Transform 방식 - home.html 전용)
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

// ✅ 아티스트 검색
function searchArtist(artistName) {
    window.location.href = `/ddoksang/search/?q=${encodeURIComponent(artistName)}`;
}

// ✅ 토스트 메시지 (ddoksangToast 사용, 중복 제거)
function showToast(message, type = 'info') {
    if (window.ddoksangToast) {
        return window.ddoksangToast.show(message, type);
    } else {
        // Fallback: 콘솔 로그
        console.log(`Toast [${type.toUpperCase()}]: ${message}`);
    }
}

// ✅ 전역 함수로 설정 (하위 호환성)
window.initBirthdayNavigation = initBirthdayNavigation;
window.searchArtist = searchArtist;
window.showToast = showToast;

