// safety_intro.js - 깔끔한 안전 거래 슬라이드 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    initSafetySlide();
});

function initSafetySlide() {
    enhanceSafetyCards();
    initSequentialAnimation();
    setupAccessibility();
}

// 카드 호버 효과 강화
function enhanceSafetyCards() {
    const safetyCards = document.querySelectorAll('.safety-feature-card');
    
    safetyCards.forEach((card, index) => {
        // 마우스 엔터
        card.addEventListener('mouseenter', function() {
            safetyCards.forEach((otherCard, otherIndex) => {
                if (otherIndex !== index) {
                    otherCard.style.opacity = '0.7';
                    otherCard.style.transform = 'scale(0.95)';
                }
            });
            this.style.zIndex = '10';
        });
        
        // 마우스 리브
        card.addEventListener('mouseleave', function() {
            safetyCards.forEach(otherCard => {
                otherCard.style.opacity = '1';
                otherCard.style.transform = 'scale(1)';
                otherCard.style.zIndex = '1';
            });
        });
    });
}

// 순차적 등장 애니메이션
function initSequentialAnimation() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const safetyCards = entry.target.querySelectorAll('.safety-feature-card');
                
                safetyCards.forEach((card, index) => {
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    }, index * 200);
                });
            }
        });
    }, { threshold: 0.3 });
    
    // safety 슬라이드 찾기
    const safetySlide = document.querySelector('#section-5'); // 6번째 슬라이드 (0부터 시작)
    if (safetySlide) {
        // 초기에는 카드들을 숨김
        const safetyCards = safetySlide.querySelectorAll('.safety-feature-card');
        safetyCards.forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        });
        
        observer.observe(safetySlide);
    }
}

// 접근성 개선
function setupAccessibility() {
    const safetyCards = document.querySelectorAll('.safety-feature-card');
    
    safetyCards.forEach((card, index) => {
        // 키보드 접근성
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        
        const labels = [
            '공식 팬덤 인증 제도 정보',
            '사기 거래 신고 제도 정보', 
            '매너 리뷰와 신뢰덕 제도 정보'
        ];
        card.setAttribute('aria-label', labels[index]);
        
        // 키보드 이벤트
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                card.click();
            }
        });
        
        // 포커스 스타일
        card.addEventListener('focus', () => {
            card.style.outline = '2px solid rgba(255, 255, 255, 0.8)';
            card.style.outlineOffset = '4px';
        });
        
        card.addEventListener('blur', () => {
            card.style.outline = 'none';
        });
    });
}

// 디버깅용
console.log('🔒 안전 거래 슬라이드 JavaScript 로드 완료');