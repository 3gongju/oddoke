/**
 * 찜한 아티스트 슬라이드 JavaScript
 * static/js/intro/favorite_artists.js
 */

class FavoriteArtistsSlider {
    constructor() {
        this.isInitialized = false;
        this.artistCards = null;
        this.loadingImages = new Set();
        
        // DOM이 준비되면 초기화
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }
    
    init() {
        if (this.isInitialized) return;
        
        console.log('🎯 찜한 아티스트 슬라이더 초기화 시작');
        
        // DOM 요소 선택
        this.artistCards = document.querySelectorAll('.favorite-artist-card');
        
        if (this.artistCards.length === 0) {
            console.log('🎯 찜한 아티스트 카드가 없음 - 빈 상태 처리');
            this.handleEmptyState();
        } else {
            console.log(`🎯 ${this.artistCards.length}개의 아티스트 카드 발견`);
            this.setupArtistCards();
            this.setupImageLazyLoading();
            this.setupAccessibility();
        }
        
        this.isInitialized = true;
        console.log('🎯 찜한 아티스트 슬라이더 초기화 완료');
    }
    
    /**
     * 아티스트 카드 설정
     */
    setupArtistCards() {
        this.artistCards.forEach((card, index) => {
            // 카드에 인덱스 추가
            card.setAttribute('data-index', index);
            
            // 호버 이벤트 추가
            card.addEventListener('mouseenter', (e) => this.handleCardHover(e, true));
            card.addEventListener('mouseleave', (e) => this.handleCardHover(e, false));
            
            // 클릭 이벤트 추가 (analytics 등)
            card.addEventListener('click', (e) => this.handleCardClick(e));
            
            // 포커스 이벤트 추가 (키보드 접근성)
            card.addEventListener('focus', (e) => this.handleCardFocus(e, true));
            card.addEventListener('blur', (e) => this.handleCardFocus(e, false));
        });
    }
    
    /**
     * 이미지 지연 로딩 설정
     */
    setupImageLazyLoading() {
        const images = document.querySelectorAll('.favorite-artist-card img');
        
        // Intersection Observer 지원 확인
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        this.loadImage(img);
                        observer.unobserve(img);
                    }
                });
            });
            
            images.forEach(img => {
                imageObserver.observe(img);
            });
        } else {
            // 지원하지 않는 경우 모든 이미지 즉시 로드
            images.forEach(img => this.loadImage(img));
        }
    }
    
    /**
     * 이미지 로딩 처리
     */
    loadImage(img) {
        const src = img.getAttribute('src');
        if (src && !this.loadingImages.has(src)) {
            this.loadingImages.add(src);
            
            // 로딩 상태 표시
            img.classList.add('artist-logo-loading');
            
            // 새 이미지 객체로 미리 로드
            const newImg = new Image();
            newImg.onload = () => {
                img.classList.remove('artist-logo-loading');
                this.loadingImages.delete(src);
            };
            newImg.onerror = () => {
                console.warn('🎯 아티스트 이미지 로드 실패:', src);
                img.classList.remove('artist-logo-loading');
                this.loadingImages.delete(src);
                // 기본 이미지로 대체
                img.src = '/static/image/ddok_logo_filled.png';
            };
            newImg.src = src;
        }
    }
    
    /**
     * 카드 호버 처리
     */
    handleCardHover(event, isEntering) {
        const card = event.currentTarget;
        const img = card.querySelector('.artist-logo-glow');
        const name = card.querySelector('.artist-name');
        
        if (isEntering) {
            // 호버 시 추가 효과
            if (img) {
                img.style.transform = 'scale(1.1) rotate(5deg)';
            }
            if (name) {
                name.style.color = '#fbbf24'; // yellow-400
            }
        } else {
            // 호버 해제 시 원상복구
            if (img) {
                img.style.transform = '';
            }
            if (name) {
                name.style.color = '';
            }
        }
    }
    
    /**
     * 카드 클릭 처리
     */
    handleCardClick(event) {
        const card = event.currentTarget;
        const artistName = card.querySelector('p')?.textContent;
        const artistId = card.href?.split('artist=')[1];
        
        console.log('🎯 아티스트 클릭:', artistName, artistId);
        
        // 클릭 애니메이션
        card.style.transform = 'scale(0.95)';
        setTimeout(() => {
            card.style.transform = '';
        }, 150);
        
        // 애널리틱스 이벤트 (필요시)
        if (typeof gtag !== 'undefined') {
            gtag('event', 'click', {
                event_category: 'favorite_artist',
                event_label: artistName,
                value: artistId
            });
        }
    }
    
    /**
     * 포커스 처리 (접근성)
     */
    handleCardFocus(event, isFocusing) {
        const card = event.currentTarget;
        
        if (isFocusing) {
            card.style.outline = '2px solid #60a5fa'; // blue-400
            card.style.outlineOffset = '2px';
        } else {
            card.style.outline = '';
            card.style.outlineOffset = '';
        }
    }
    
    /**
     * 빈 상태 처리
     */
    handleEmptyState() {
        const emptyStateElement = document.querySelector('.empty-state');
        if (emptyStateElement) {
            // 빈 상태 애니메이션 추가
            emptyStateElement.style.opacity = '0';
            emptyStateElement.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                emptyStateElement.style.transition = 'all 0.8s ease';
                emptyStateElement.style.opacity = '1';
                emptyStateElement.style.transform = 'translateY(0)';
            }, 100);
        }
    }
    
    /**
     * 접근성 설정
     */
    setupAccessibility() {
        this.artistCards.forEach(card => {
            // 키보드 접근성
            if (!card.getAttribute('tabindex')) {
                card.setAttribute('tabindex', '0');
            }
            
            // ARIA 라벨 추가
            const artistName = card.querySelector('p')?.textContent;
            if (artistName) {
                card.setAttribute('aria-label', `${artistName} 아티스트 페이지로 이동`);
            }
            
            // 키보드 이벤트
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
        });
    }
    
    /**
     * 스크롤 트리거 시 애니메이션
     */
    triggerScrollAnimation() {
        this.artistCards.forEach((card, index) => {
            setTimeout(() => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(30px)';
                card.style.transition = 'all 0.6s ease';
                
                setTimeout(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, 50);
            }, index * 100);
        });
    }
    
    /**
     * 반응형 처리
     */
    handleResize() {
        // 모바일에서는 호버 효과 제거
        const isMobile = window.innerWidth < 768;
        
        this.artistCards.forEach(card => {
            if (isMobile) {
                card.style.pointerEvents = 'auto';
            } else {
                card.style.pointerEvents = '';
            }
        });
    }
    
    /**
     * 정리 함수
     */
    destroy() {
        this.artistCards?.forEach(card => {
            card.removeEventListener('mouseenter', this.handleCardHover);
            card.removeEventListener('mouseleave', this.handleCardHover);
            card.removeEventListener('click', this.handleCardClick);
            card.removeEventListener('focus', this.handleCardFocus);
            card.removeEventListener('blur', this.handleCardFocus);
        });
        
        this.isInitialized = false;
        console.log('🎯 찜한 아티스트 슬라이더 정리 완료');
    }
}

// 전역 인스턴스 생성
let favoriteArtistsSlider = null;

// 슬라이더 초기화 함수 (외부에서 호출 가능)
function initFavoriteArtistsSlider() {
    if (!favoriteArtistsSlider) {
        favoriteArtistsSlider = new FavoriteArtistsSlider();
    }
    return favoriteArtistsSlider;
}

// 슬라이더 정리 함수
function destroyFavoriteArtistsSlider() {
    if (favoriteArtistsSlider) {
        favoriteArtistsSlider.destroy();
        favoriteArtistsSlider = null;
    }
}

// 자동 초기화
document.addEventListener('DOMContentLoaded', () => {
    initFavoriteArtistsSlider();
});

// 윈도우 리사이즈 이벤트
window.addEventListener('resize', () => {
    if (favoriteArtistsSlider) {
        favoriteArtistsSlider.handleResize();
    }
});

// 전역 함수로 내보내기
window.FavoriteArtistsSlider = FavoriteArtistsSlider;
window.initFavoriteArtistsSlider = initFavoriteArtistsSlider;
window.destroyFavoriteArtistsSlider = destroyFavoriteArtistsSlider;