/**
 * 찜한 아티스트 인트로 슬라이드 JavaScript
 * static/js/intro/favorite_artists_intro.js
 */

document.addEventListener('DOMContentLoaded', function() {
    initFavoriteArtistsIntroSlide();
});

function initFavoriteArtistsIntroSlide() {
    console.log('🎯 찜한 아티스트 인트로 슬라이드 초기화');
    
    setupArtistCardEffects();
    setupAccessibility();
    setupImageHandling();
    
    console.log('🎯 찜한 아티스트 인트로 슬라이드 초기화 완료');
}

/**
 * 아티스트 카드 효과 설정
 */
function setupArtistCardEffects() {
    const artistItems = document.querySelectorAll('.favorite-artist-item');
    
    artistItems.forEach((item, index) => {
        // 호버 시 다른 카드들 흐리게 하기
        item.addEventListener('mouseenter', function() {
            artistItems.forEach((otherItem, otherIndex) => {
                if (otherIndex !== index) {
                    otherItem.style.opacity = '0.6';
                    otherItem.style.transform = 'scale(0.95)';
                }
            });
        });
        
        // 호버 해제 시 원상복구
        item.addEventListener('mouseleave', function() {
            artistItems.forEach(otherItem => {
                otherItem.style.opacity = '1';
                otherItem.style.transform = 'scale(1)';
            });
        });
        
        // 클릭 애니메이션
        item.addEventListener('click', function(e) {
            // 클릭 리플 효과
            const ripple = document.createElement('div');
            ripple.style.position = 'absolute';
            ripple.style.borderRadius = '50%';
            ripple.style.background = 'rgba(96, 165, 250, 0.6)';
            ripple.style.transform = 'scale(0)';
            ripple.style.animation = 'ripple 0.6s linear';
            ripple.style.pointerEvents = 'none';
            
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
            ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => {
                if (ripple.parentNode) {
                    ripple.parentNode.removeChild(ripple);
                }
            }, 600);
        });
    });
}

/**
 * 접근성 설정
 */
function setupAccessibility() {
    const artistItems = document.querySelectorAll('.favorite-artist-item');
    
    artistItems.forEach((item, index) => {
        // 키보드 접근성
        item.setAttribute('tabindex', '0');
        
        // ARIA 라벨
        const artistName = item.querySelector('p')?.textContent;
        if (artistName) {
            item.setAttribute('aria-label', `${artistName} 아티스트 페이지로 이동`);
        }
        
        // 키보드 이벤트
        item.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
        
        // 포커스 이벤트
        item.addEventListener('focus', function() {
            this.style.outline = '2px solid #60a5fa';
            this.style.outlineOffset = '2px';
        });
        
        item.addEventListener('blur', function() {
            this.style.outline = '';
            this.style.outlineOffset = '';
        });
    });
}

/**
 * 이미지 처리
 */
function setupImageHandling() {
    const images = document.querySelectorAll('.favorite-artist-item img');
    
    images.forEach(img => {
        // 이미지 로딩 에러 처리
        img.addEventListener('error', function() {
            console.warn('🎯 아티스트 이미지 로드 실패:', this.src);
            this.src = '/static/image/ddok_logo_filled.png';
            this.alt = '기본 로고';
        });
        
        // 이미지 로딩 완료 처리
        img.addEventListener('load', function() {
            this.classList.add('loaded');
        });
        
        // 지연 로딩
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                        imageObserver.unobserve(img);
                    }
                });
            });
            
            if (img.dataset.src) {
                imageObserver.observe(img);
            }
        }
    });
}

/**
 * 스크롤 애니메이션 트리거
 */
function triggerFavoriteArtistsAnimation() {
    const container = document.querySelector('.favorite-artist-item').closest('.bg-black.bg-opacity-80');
    if (!container) return;
    
    // 컨테이너 페이드 인
    container.style.opacity = '0';
    container.style.transform = 'translateY(30px)';
    container.style.transition = 'all 0.8s ease';
    
    setTimeout(() => {
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
    }, 100);
    
    // 아티스트 카드들 순차 애니메이션
    const artistItems = document.querySelectorAll('.favorite-artist-item');
    artistItems.forEach((item, index) => {
        setTimeout(() => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px) scale(0.8)';
            item.style.transition = 'all 0.6s ease';
            
            setTimeout(() => {
                item.style.opacity = '1';
                item.style.transform = 'translateY(0) scale(1)';
            }, 50);
        }, 200 + (index * 150));
    });
}

/**
 * 반응형 처리
 */
function handleFavoriteArtistsResize() {
    const isMobile = window.innerWidth < 768;
    const container = document.querySelector('.bg-black.bg-opacity-80');
    
    if (container && isMobile) {
        // 모바일에서 추가 최적화
        container.style.padding = '1.5rem';
    }
}

// 리사이즈 이벤트
window.addEventListener('resize', handleFavoriteArtistsResize);

// CSS 애니메이션 정의
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    .favorite-artist-item.loaded img {
        animation: fadeInScale 0.5s ease;
    }
    
    @keyframes fadeInScale {
        from {
            opacity: 0;
            transform: scale(0.8);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
`;
document.head.appendChild(style);

// 전역 함수로 내보내기
window.triggerFavoriteArtistsAnimation = triggerFavoriteArtistsAnimation;
window.handleFavoriteArtistsResize = handleFavoriteArtistsResize;