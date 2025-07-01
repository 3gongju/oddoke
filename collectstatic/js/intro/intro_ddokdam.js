/* C:\Users\1-17\Desktop\DAMF2\oddoke\static\js\intro\intro_ddokdam.js */

// 덕담 슬라이드 전용 JavaScript - 인덱스 페이지와 동일한 상호작용

/**
 * 덕담 게시물 클릭 시 해당 페이지로 이동
 * @param {string} url - 게시물 상세 페이지 URL
 */
function openDdokdamPost(url) {
    if (url && url !== 'None' && url !== '') {
        window.open(url, '_blank');
    } else {
        console.warn('유효하지 않은 덕담 게시물 URL:', url);
    }
}

/**
 * 좋아요 버튼 클릭 처리 (시각적 피드백만)
 * @param {Event} event - 클릭 이벤트
 * @param {HTMLElement} button - 좋아요 버튼 요소
 */
function handleLikeClick(event, button) {
    event.stopPropagation();
    
    // 버튼 애니메이션
    button.style.transform = 'scale(0.8)';
    button.style.transition = 'transform 0.1s ease';
    
    setTimeout(() => {
        button.style.transform = 'scale(1.2)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 100);
    }, 100);
    
    // 하트 색상 변경 효과
    const heart = button.querySelector('svg');
    if (heart) {
        heart.style.color = '#e53e3e';
        heart.style.fill = '#e53e3e';
        
        // 0.5초 후 원래 색상으로 복원
        setTimeout(() => {
            heart.style.color = '#e53e3e';
            heart.style.fill = 'currentColor';
        }, 500);
    }
}

/**
 * 덕담 섹션이 화면에 나타날 때 애니메이션 효과
 */
function initDdokdamSlideAnimations() {
    const ddokdamCards = document.querySelectorAll('.ddokdam-post-card');
    
    // 카드들을 순차적으로 나타나게 하는 애니메이션
    ddokdamCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'all 0.5s ease';
        
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 150 + 300); // 0.3초 후부터 0.15초 간격으로 순차 표시
    });
}

/**
 * 덕담 카드 호버 효과 강화
 */
function enhanceDdokdamCardHoverEffects() {
    const ddokdamCards = document.querySelectorAll('.ddokdam-post-card');
    
    ddokdamCards.forEach(card => {
        // 마우스 엔터 시
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-4px)';
            this.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.15)';
        });
        
        // 마우스 리브 시
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.1)';
        });
        
        // 클릭 시 임시 눌림 효과
        card.addEventListener('mousedown', function() {
            this.style.transform = 'translateY(-2px) scale(0.98)';
        });
        
        card.addEventListener('mouseup', function() {
            this.style.transform = 'translateY(-4px) scale(1)';
        });
    });
}

/**
 * 덕담 더보기 버튼 애니메이션
 */
function initDdokdamMoreButtonAnimation() {
    const moreBtn = document.querySelector('.ddokdam-more-btn');
    
    if (moreBtn) {
        moreBtn.addEventListener('mouseenter', function() {
            const arrow = this.querySelector('svg');
            if (arrow) {
                arrow.style.transform = 'translateX(4px)';
                arrow.style.transition = 'transform 0.3s ease';
            }
        });
        
        moreBtn.addEventListener('mouseleave', function() {
            const arrow = this.querySelector('svg');
            if (arrow) {
                arrow.style.transform = 'translateX(0)';
            }
        });
    }
}

/**
 * 좋아요 버튼 이벤트 리스너 설정
 */
function initLikeButtons() {
    const likeButtons = document.querySelectorAll('.ddokdam-like-btn');
    
    likeButtons.forEach(button => {
        button.addEventListener('click', function(event) {
            handleLikeClick(event, this);
        });
        
        // 호버 효과
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
            this.style.boxShadow = '0 4px 12px rgba(229, 62, 62, 0.3)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
            this.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        });
    });
}

/**
 * 덕담 슬라이드가 현재 보이는 슬라이드인지 확인하고 애니메이션 실행
 */
function checkDdokdamSlideVisibility() {
    const ddokdamSection = document.querySelector('#section-2'); // 덕담은 3번째 슬라이드 (0부터 시작하므로 index 2)
    
    if (ddokdamSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                    // 덕담 슬라이드가 화면에 절반 이상 보일 때 애니메이션 실행
                    setTimeout(() => {
                        initDdokdamSlideAnimations();
                    }, 200);
                }
            });
        }, {
            threshold: 0.5
        });
        
        observer.observe(ddokdamSection);
    }
}

/**
 * 덕담 슬라이드 에러 핸들링
 */
function handleDdokdamErrors() {
    const ddokdamImages = document.querySelectorAll('.ddokdam-post-image');
    
    ddokdamImages.forEach(img => {
        img.addEventListener('error', function() {
            // 이미지 로드 실패 시 기본 그라데이션으로 대체
            this.style.background = 'linear-gradient(135deg, #f8fafc, #e2e8f0)';
            this.style.display = 'flex';
            this.style.alignItems = 'center';
            this.style.justifyContent = 'center';
            this.innerHTML = '<span style="color: #718096; font-size: 0.875rem;">이미지 없음</span>';
        });
    });
}

/**
 * 모바일에서 덕담 카드 터치 피드백
 */
function initDdokdamMobileTouchFeedback() {
    if ('ontouchstart' in window) {
        const ddokdamCards = document.querySelectorAll('.ddokdam-post-card');
        
        ddokdamCards.forEach(card => {
            card.addEventListener('touchstart', function() {
                this.style.transform = 'translateY(-2px) scale(0.98)';
                this.style.transition = 'transform 0.1s ease';
            });
            
            card.addEventListener('touchend', function() {
                setTimeout(() => {
                    this.style.transform = 'translateY(0) scale(1)';
                    this.style.transition = 'transform 0.3s ease';
                }, 100);
            });
        });
        
        // 좋아요 버튼 터치 피드백
        const likeButtons = document.querySelectorAll('.ddokdam-like-btn');
        likeButtons.forEach(button => {
            button.addEventListener('touchstart', function(event) {
                event.stopPropagation();
                this.style.transform = 'scale(0.9)';
            });
            
            button.addEventListener('touchend', function(event) {
                event.stopPropagation();
                handleLikeClick(event, this);
            });
        });
    }
}

/**
 * 카드 로딩 상태 시뮬레이션
 */
function simulateCardLoading() {
    const ddokdamCards = document.querySelectorAll('.ddokdam-post-card');
    
    ddokdamCards.forEach((card, index) => {
        // 로딩 상태 추가
        card.style.opacity = '0.3';
        card.style.pointerEvents = 'none';
        
        // 순차적으로 로딩 완료
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.pointerEvents = 'auto';
            card.style.transition = 'opacity 0.3s ease';
        }, index * 100 + 500);
    });
}

/**
 * 덕담 슬라이드 초기화 함수
 */
function initDdokdamSlide() {
    console.log('덕담 슬라이드 초기화 시작 - 인덱스 UI 스타일');
    
    try {
        // 에러 핸들링 먼저 설정
        handleDdokdamErrors();
        
        // 좋아요 버튼 초기화
        initLikeButtons();
        
        // 호버 효과 설정
        enhanceDdokdamCardHoverEffects();
        
        // 더보기 버튼 애니메이션 설정
        initDdokdamMoreButtonAnimation();
        
        // 모바일 터치 피드백 설정
        initDdokdamMobileTouchFeedback();
        
        // 슬라이드 가시성 관찰자 설정
        checkDdokdamSlideVisibility();
        
        // 로딩 애니메이션 시뮬레이션
        simulateCardLoading();
        
        console.log('덕담 슬라이드 초기화 완료');
    } catch (error) {
        console.error('덕담 슬라이드 초기화 중 오류:', error);
    }
}

// DOM 로드 완료 시 덕담 슬라이드 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 약간의 지연 후 초기화 (다른 스크립트들이 먼저 로드되도록)
    setTimeout(() => {
        initDdokdamSlide();
    }, 100);
});

// 전역 스코프에 함수 노출 (다른 스크립트에서 접근 가능하도록)
window.openDdokdamPost = openDdokdamPost;
window.initDdokdamSlideAnimations = initDdokdamSlideAnimations;
window.handleLikeClick = handleLikeClick;