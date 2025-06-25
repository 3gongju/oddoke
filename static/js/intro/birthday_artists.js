/**
 * 덕생 - 아티스트 생일 달력 슬라이드 JavaScript
 * static/js/intro/birthday_artists.js
 */

class BirthdayArtistsSlider {
    constructor() {
        this.isInitialized = false;
        this.slider = null;
        this.container = null;
        this.prevBtn = null;
        this.nextBtn = null;
        this.slides = null;
        
        // 슬라이더 상태
        this.currentIndex = 0;
        this.itemsPerView = 1;
        this.totalPages = 0;
        this.autoSlideInterval = null;
        
        // 터치/드래그 상태
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        
        // DOM이 준비되면 초기화
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }
    
    init() {
        if (this.isInitialized) return;
        
        console.log('🎂 생일 아티스트 슬라이더 초기화 시작');
        
        // DOM 요소 선택
        this.slider = document.querySelector('.birthday-slider-track');
        this.container = document.querySelector('.birthday-slider-container');
        this.prevBtn = document.querySelector('.birthday-nav-btn.prev');
        this.nextBtn = document.querySelector('.birthday-nav-btn.next');
        
        if (!this.slider || !this.container) {
            console.log('🎂 생일 슬라이더 DOM 요소를 찾을 수 없음');
            return;
        }
        
        this.slides = this.slider.children;
        
        if (this.slides.length === 0) {
            console.log('🎂 생일 아티스트 데이터가 없음 - 빈 상태 처리');
            this.handleEmptyState();
            return;
        }
        
        console.log(`🎂 ${this.slides.length}개의 생일 아티스트 발견`);
        
        // 슬라이더 설정
        this.setupSlider();
        this.setupEventListeners();
        this.setupAccessibility();
        this.startAutoSlide();
        
        this.isInitialized = true;
        console.log('🎂 생일 아티스트 슬라이더 초기화 완료');
    }
    
    /**
     * 슬라이더 설정
     */
    setupSlider() {
        this.itemsPerView = this.getItemsPerView();
        this.totalPages = Math.ceil(this.slides.length / this.itemsPerView);
        
        // 초기 위치 설정
        this.goToPage(0);
        this.updateButtons();
        
        console.log(`🎂 슬라이더 설정 완료 - ${this.itemsPerView}개/페이지, 총 ${this.totalPages}페이지`);
    }
    
    /**
     * 화면 크기별 표시 아이템 수 계산
     */
    getItemsPerView() {
        const width = window.innerWidth;
        if (width >= 1280) return 5;      // xl: 5개
        if (width >= 1024) return 4;      // lg: 4개  
        if (width >= 768) return 3;       // md: 3개
        if (width >= 640) return 2;       // sm: 2개
        return 1;                         // 모바일: 1개
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 네비게이션 버튼
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => this.prevSlide());
        }
        
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => this.nextSlide());
        }
        
        // 터치/마우스 이벤트
        this.container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        this.container.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
        this.container.addEventListener('mousedown', (e) => this.handleMouseStart(e));
        this.container.addEventListener('mouseup', (e) => this.handleMouseEnd(e));
        this.container.addEventListener('mouseleave', () => this.handleMouseLeave());
        
        // 호버 시 자동 슬라이드 제어
        this.container.addEventListener('mouseenter', () => this.stopAutoSlide());
        this.container.addEventListener('mouseleave', () => this.startAutoSlide());
        
        // 윈도우 리사이즈
        window.addEventListener('resize', () => this.handleResize());
        
        // 키보드 이벤트 (컨테이너에 포커스가 있을 때)
        this.container.addEventListener('keydown', (e) => this.handleKeydown(e));
    }
    
    /**
     * 접근성 설정
     */
    setupAccessibility() {
        // 컨테이너에 role과 aria 속성 추가
        this.container.setAttribute('role', 'region');
        this.container.setAttribute('aria-label', '생일 아티스트 슬라이더');
        this.container.setAttribute('tabindex', '0');
        
        // 각 슬라이드 아이템에 접근성 속성 추가
        Array.from(this.slides).forEach((slide, index) => {
            const card = slide.querySelector('.birthday-card');
            if (card) {
                card.setAttribute('role', 'article');
                card.setAttribute('tabindex', '0');
                
                const artistName = slide.querySelector('.birthday-artist-name')?.textContent;
                const groupName = slide.querySelector('.birthday-group-name')?.textContent;
                const birthdayDate = slide.querySelector('.birthday-date-text')?.textContent;
                
                let ariaLabel = `${artistName}`;
                if (groupName) ariaLabel += `, ${groupName}`;
                if (birthdayDate) ariaLabel += `, 생일 ${birthdayDate}`;
                
                card.setAttribute('aria-label', ariaLabel);
            }
        });
        
        // 네비게이션 버튼 접근성
        if (this.prevBtn) {
            this.prevBtn.setAttribute('aria-label', '이전 생일 아티스트 보기');
        }
        if (this.nextBtn) {
            this.nextBtn.setAttribute('aria-label', '다음 생일 아티스트 보기');
        }
    }
    
    /**
     * 특정 페이지로 이동
     */
    goToPage(pageIndex) {
        if (pageIndex < 0 || pageIndex >= this.totalPages) return;
        
        this.currentIndex = pageIndex;
        const translateX = -(this.currentIndex * 100);
        this.slider.style.transform = `translateX(${translateX}%)`;
        
        this.updateButtons();
        this.announceSlideChange();
    }
    
    /**
     * 다음 슬라이드
     */
    nextSlide() {
        this.stopAutoSlide();
        const nextIndex = Math.min(this.currentIndex + 1, this.totalPages - 1);
        this.goToPage(nextIndex);
        this.startAutoSlide();
    }
    
    /**
     * 이전 슬라이드
     */
    prevSlide() {
        this.stopAutoSlide();
        const prevIndex = Math.max(this.currentIndex - 1, 0);
        this.goToPage(prevIndex);
        this.startAutoSlide();
    }
    
    /**
     * 버튼 상태 업데이트
     */
    updateButtons() {
        if (this.prevBtn) {
            this.prevBtn.disabled = this.currentIndex === 0;
        }
        if (this.nextBtn) {
            this.nextBtn.disabled = this.currentIndex >= this.totalPages - 1;
        }
    }
    
    /**
     * 자동 슬라이드 시작
     */
    startAutoSlide() {
        if (this.totalPages <= 1) return;
        
        this.stopAutoSlide();
        this.autoSlideInterval = setInterval(() => {
            if (this.currentIndex >= this.totalPages - 1) {
                this.goToPage(0); // 처음으로 돌아가기
            } else {
                this.nextSlide();
            }
        }, 8000); // 8초마다 자동 이동
    }
    
    /**
     * 자동 슬라이드 중지
     */
    stopAutoSlide() {
        if (this.autoSlideInterval) {
            clearInterval(this.autoSlideInterval);
            this.autoSlideInterval = null;
        }
    }
    
    /**
     * 터치 시작 처리
     */
    handleTouchStart(e) {
        this.isDragging = true;
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
        this.stopAutoSlide();
    }
    
    /**
     * 터치 종료 처리
     */
    handleTouchEnd(e) {
        if (!this.isDragging) return;
        
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = this.startX - endX;
        const diffY = this.startY - endY;
        const threshold = 50;
        
        // 수직 스크롤이 더 큰 경우 슬라이드 방지
        if (Math.abs(diffY) > Math.abs(diffX)) {
            this.isDragging = false;
            this.startAutoSlide();
            return;
        }
        
        if (Math.abs(diffX) > threshold) {
            if (diffX > 0) {
                this.nextSlide(); // 왼쪽으로 스와이프 -> 다음
            } else {
                this.prevSlide(); // 오른쪽으로 스와이프 -> 이전
            }
        }
        
        this.isDragging = false;
        this.startAutoSlide();
    }
    
    /**
     * 마우스 시작 처리
     */
    handleMouseStart(e) {
        e.preventDefault();
        this.isDragging = true;
        this.startX = e.clientX;
        this.stopAutoSlide();
    }
    
    /**
     * 마우스 종료 처리
     */
    handleMouseEnd(e) {
        if (!this.isDragging) return;
        
        const endX = e.clientX;
        const diffX = this.startX - endX;
        const threshold = 50;
        
        if (Math.abs(diffX) > threshold) {
            if (diffX > 0) {
                this.nextSlide();
            } else {
                this.prevSlide();
            }
        }
        
        this.isDragging = false;
        this.startAutoSlide();
    }
    
    /**
     * 마우스 떠남 처리
     */
    handleMouseLeave() {
        if (this.isDragging) {
            this.isDragging = false;
            this.startAutoSlide();
        }
    }
    
    /**
     * 키보드 이벤트 처리
     */
    handleKeydown(e) {
        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.prevSlide();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.nextSlide();
                break;
            case 'Home':
                e.preventDefault();
                this.goToPage(0);
                break;
            case 'End':
                e.preventDefault();
                this.goToPage(this.totalPages - 1);
                break;
        }
    }
    
    /**
     * 화면 크기 변경 처리
     */
    handleResize() {
        const newItemsPerView = this.getItemsPerView();
        if (newItemsPerView !== this.itemsPerView) {
            this.itemsPerView = newItemsPerView;
            this.totalPages = Math.ceil(this.slides.length / this.itemsPerView);
            
            // 현재 페이지가 범위를 벗어나면 조정
            if (this.currentIndex >= this.totalPages) {
                this.currentIndex = this.totalPages - 1;
            }
            
            this.goToPage(this.currentIndex);
            console.log(`🎂 리사이즈: ${this.itemsPerView}개/페이지, 총 ${this.totalPages}페이지`);
        }
    }
    
    /**
     * 슬라이드 변경 알림 (스크린 리더용)
     */
    announceSlideChange() {
        const announcement = `${this.totalPages}페이지 중 ${this.currentIndex + 1}페이지`;
        
        // 임시 요소 생성하여 스크린 리더에 알림
        const announcer = document.createElement('div');
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('aria-atomic', 'true');
        announcer.style.position = 'absolute';
        announcer.style.left = '-10000px';
        announcer.textContent = announcement;
        
        document.body.appendChild(announcer);
        setTimeout(() => {
            document.body.removeChild(announcer);
        }, 1000);
    }
    
    /**
     * 빈 상태 처리
     */
    handleEmptyState() {
        const emptyState = this.container.querySelector('.birthday-empty-state');
        if (emptyState) {
            // 빈 상태 애니메이션
            setTimeout(() => {
                emptyState.style.opacity = '1';
                emptyState.style.transform = 'translateY(0)';
            }, 100);
        }
    }
    
    /**
     * 슬라이드 스크롤 트리거 애니메이션
     */
    triggerScrollAnimation() {
        Array.from(this.slides).forEach((slide, index) => {
            setTimeout(() => {
                slide.style.opacity = '0';
                slide.style.transform = 'translateY(30px)';
                slide.style.transition = 'all 0.6s ease';
                
                setTimeout(() => {
                    slide.style.opacity = '1';
                    slide.style.transform = 'translateY(0)';
                }, 50);
            }, index * 100);
        });
    }
    
    /**
     * 특정 아티스트로 이동
     */
    goToArtist(artistName) {
        Array.from(this.slides).forEach((slide, index) => {
            const nameElement = slide.querySelector('.birthday-artist-name');
            if (nameElement && nameElement.textContent.includes(artistName)) {
                const pageIndex = Math.floor(index / this.itemsPerView);
                this.goToPage(pageIndex);
                
                // 해당 카드에 포커스
                setTimeout(() => {
                    const card = slide.querySelector('.birthday-card');
                    if (card) {
                        card.focus();
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 600);
                
                return true;
            }
        });
        return false;
    }
    
    /**
     * 현재 상태 정보 반환
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            currentIndex: this.currentIndex,
            totalPages: this.totalPages,
            itemsPerView: this.itemsPerView,
            totalArtists: this.slides ? this.slides.length : 0,
            isAutoSliding: !!this.autoSlideInterval
        };
    }
    
    /**
     * 정리 함수
     */
    destroy() {
        this.stopAutoSlide();
        
        // 이벤트 리스너 정리
        if (this.prevBtn) {
            this.prevBtn.removeEventListener('click', this.prevSlide);
        }
        if (this.nextBtn) {
            this.nextBtn.removeEventListener('click', this.nextSlide);
        }
        
        window.removeEventListener('resize', this.handleResize);
        
        this.isInitialized = false;
        console.log('🎂 생일 아티스트 슬라이더 정리 완료');
    }
}

// 전역 인스턴스 생성
let birthdayArtistsSlider = null;

// 슬라이더 초기화 함수 (외부에서 호출 가능)
function initBirthdayArtistsSlider() {
    if (!birthdayArtistsSlider) {
        birthdayArtistsSlider = new BirthdayArtistsSlider();
    }
    return birthdayArtistsSlider;
}

// 슬라이더 정리 함수
function destroyBirthdayArtistsSlider() {
    if (birthdayArtistsSlider) {
        birthdayArtistsSlider.destroy();
        birthdayArtistsSlider = null;
    }
}

// 특정 아티스트로 이동하는 전역 함수
function goToBirthdayArtist(artistName) {
    if (birthdayArtistsSlider) {
        return birthdayArtistsSlider.goToArtist(artistName);
    }
    return false;
}

// 슬라이더 상태 확인 함수
function getBirthdaySliderStatus() {
    if (birthdayArtistsSlider) {
        return birthdayArtistsSlider.getStatus();
    }
    return null;
}

// 자동 초기화
document.addEventListener('DOMContentLoaded', () => {
    initBirthdayArtistsSlider();
});

// 전역 함수로 내보내기
window.BirthdayArtistsSlider = BirthdayArtistsSlider;
window.initBirthdayArtistsSlider = initBirthdayArtistsSlider;
window.destroyBirthdayArtistsSlider = destroyBirthdayArtistsSlider;
window.goToBirthdayArtist = goToBirthdayArtist;
window.getBirthdaySliderStatus = getBirthdaySliderStatus;