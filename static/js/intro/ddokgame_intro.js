/**
 * 덕 쌓기 게임 인트로 슬라이드 JavaScript
 * static/js/intro/ddokgame_intro.js
 */

document.addEventListener('DOMContentLoaded', function() {
    initDdokGameIntroSlide();
});

class DdokGameIntroSlide {
    constructor() {
        this.targetTime = new Date();
        this.currentScore = 0;
        this.isGameActive = false;
        this.animationFrameId = null;
        
        // 목표 시간을 07:01:00으로 고정
        this.targetTime.setHours(7, 1, 0, 0);
        
        this.init();
    }
    
    init() {
        console.log('🎮 덕 쌓기 게임 인트로 초기화');
        
        this.setupElements();
        this.setupEventListeners();
        this.setupTargetTime();
        this.startTimeDisplay(); // 시간 표시 즉시 시작
        
        console.log('🎮 덕 쌓기 게임 인트로 초기화 완료');
    }
    
    setupElements() {
        this.elements = {
            targetTimeDisplay: document.querySelector('.target-time-value'),
            currentTimeMain: document.querySelector('.time-main'),
            currentTimeMs: document.querySelector('.time-ms'),
            ddokButton: document.querySelector('.ddok-button'),
            ddokCounter: document.querySelector('.ddok-counter'),
            resultContainer: document.querySelector('.result-container'),
            resultText: document.querySelector('.result-text'),
            demoBtn: document.querySelector('.demo-btn'),
            memberImage: document.querySelector('.member-image'),
            bannerImage: document.querySelector('.banner-image')
        };
        
        // DOM 요소 존재 확인 및 디버깅
        console.log('🎮 DOM 요소 확인:');
        console.log('- currentTimeMain:', !!this.elements.currentTimeMain, this.elements.currentTimeMain);
        console.log('- currentTimeMs:', !!this.elements.currentTimeMs, this.elements.currentTimeMs);
        console.log('- ddokButton:', !!this.elements.ddokButton);
        console.log('- targetTimeDisplay:', !!this.elements.targetTimeDisplay);
        
        // 시간 표시 요소가 없으면 경고
        if (!this.elements.currentTimeMain || !this.elements.currentTimeMs) {
            console.warn('🎮 시간 표시 DOM 요소를 찾을 수 없습니다!');
        }
    }
    
    setupEventListeners() {
        // 덕 쌓기 버튼
        if (this.elements.ddokButton) {
            this.elements.ddokButton.addEventListener('click', (e) => this.handleDdokClick(e));
        }
        
        // 데모 버튼 (있는 경우만)
        if (this.elements.demoBtn) {
            this.elements.demoBtn.addEventListener('click', (e) => this.handleDemoClick(e));
        }
        
        // 배너 이미지 클릭
        if (this.elements.bannerImage) {
            this.elements.bannerImage.addEventListener('click', (e) => this.handleBannerClick(e));
        }
        
        // 멤버 이미지 호버 효과
        if (this.elements.memberImage) {
            this.elements.memberImage.addEventListener('mouseenter', () => this.handleMemberHover(true));
            this.elements.memberImage.addEventListener('mouseleave', () => this.handleMemberHover(false));
        }
    }
    
    setupTargetTime() {
        // 목표 시간을 07:01:00으로 고정 표시
        if (this.elements.targetTimeDisplay) {
            this.elements.targetTimeDisplay.textContent = '07:01:00';
        }
        
        console.log('🎮 목표 시간 고정: 07:01:00');
    }
    
    startTimeDisplay() {
        console.log('🎮 시간 표시 시작');
        
        const updateTime = () => {
            const now = new Date();
            
            // 현재 시간 표시 (birthday_game.js와 동일한 로직)
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
            
            // DOM 요소 존재 확인 후 업데이트
            if (this.elements.currentTimeMain) {
                this.elements.currentTimeMain.textContent = `${hours}:${minutes}:${seconds}`;
                console.log('🎮 시간 업데이트:', `${hours}:${minutes}:${seconds}`);
            } else {
                console.warn('🎮 currentTimeMain 요소를 찾을 수 없음');
            }
            
            if (this.elements.currentTimeMs) {
                this.elements.currentTimeMs.textContent = `.${milliseconds}`;
            } else {
                console.warn('🎮 currentTimeMs 요소를 찾을 수 없음');
            }
            
            this.animationFrameId = requestAnimationFrame(updateTime);
        };
        
        // 즉시 시작
        updateTime();
    }
    
    handleDdokClick(event) {
        event.preventDefault();
        
        // 클릭 애니메이션
        this.animateButtonClick();
        
        // 현재 시간과 목표 시간(07:01:00)의 차이 계산
        const now = new Date();
        
        // 목표 시간: 07:01:00
        const targetTime = new Date();
        targetTime.setHours(7, 1, 0, 0);
        
        // 시간 차이 계산 (밀리초)
        const timeDiff = Math.abs(now.getTime() - targetTime.getTime());
        
        // 정확도에 따른 점수 계산
        const earnedDdok = this.calculateAccuracyDdok(timeDiff);
        this.currentScore += earnedDdok;
        
        // UI 업데이트
        this.updateScore();
        this.showResult(earnedDdok, timeDiff);
        
        console.log(`🎮 덕 쌓기! 시간차: ${(timeDiff/1000).toFixed(3)}초, +${earnedDdok}덕 획득`);
    }
    
    calculateAccuracyDdok(timeDiff) {
        // 시간 차이에 따른 점수 계산 (밀리초 단위)
        const diffSeconds = timeDiff / 1000;
        
        if (diffSeconds < 0.1) return 1000;      // 0.1초 이내: 1000덕
        if (diffSeconds < 0.5) return 500;       // 0.5초 이내: 500덕
        if (diffSeconds < 1) return 200;         // 1초 이내: 200덕
        if (diffSeconds < 3) return 100;         // 3초 이내: 100덕
        if (diffSeconds < 5) return 50;          // 5초 이내: 50덕
        if (diffSeconds < 10) return 25;         // 10초 이내: 25덕
        return 10;                               // 그 외: 10덕
    }
    
    handleDemoClick(event) {
        event.preventDefault();
        
        // 데모 자동 플레이
        this.startDemoMode();
        
        console.log('🎮 데모 모드 시작');
    }
    
    handleBannerClick(event) {
        // 배너 클릭 효과
        this.animateBannerClick();
        
        console.log('🎮 배너 클릭됨');
    }
    
    handleMemberHover(isEntering) {
        const memberCard = this.elements.memberImage?.closest('.member-card');
        if (!memberCard) return;
        
        if (isEntering) {
            memberCard.style.transform = 'translateY(-5px) scale(1.02)';
            memberCard.style.background = 'rgba(139, 92, 246, 0.2)';
        } else {
            memberCard.style.transform = '';
            memberCard.style.background = '';
        }
    }
    
    updateScore() {
        if (this.elements.ddokCounter) {
            this.animateCounterUpdate(this.currentScore);
        }
    }
    
    animateCounterUpdate(newScore) {
        const counter = this.elements.ddokCounter;
        const currentScore = parseInt(counter.textContent) || 0;
        const increment = (newScore - currentScore) / 20;
        let current = currentScore;
        
        const updateNumber = () => {
            current += increment;
            if (current >= newScore) {
                current = newScore;
                counter.textContent = Math.floor(current).toLocaleString();
                return;
            }
            counter.textContent = Math.floor(current).toLocaleString();
            requestAnimationFrame(updateNumber);
        };
        
        updateNumber();
    }
    
    showResult(earnedDdok, timeDiff = 0) {
        if (!this.elements.resultContainer || !this.elements.resultText) return;
        
        const diffSeconds = (timeDiff / 1000).toFixed(3);
        
        // 결과 메시지 설정 (시간 차이 기반)
        let message = '';
        let messageClass = 'text-green-400';
        
        if (earnedDdok >= 1000) {
            message = `완벽해요! 신의 한 수! (+${earnedDdok}덕)`;
            messageClass = 'text-yellow-400';
        } else if (earnedDdok >= 500) {
            message = `대박! ${diffSeconds}초 차이! (+${earnedDdok}덕)`;
            messageClass = 'text-green-400';
        } else if (earnedDdok >= 200) {
            message = `좋아요! ${diffSeconds}초 차이! (+${earnedDdok}덕)`;
            messageClass = 'text-blue-400';
        } else if (earnedDdok >= 100) {
            message = `괜찮아요! ${diffSeconds}초 차이! (+${earnedDdok}덕)`;
            messageClass = 'text-purple-400';
        } else {
            message = `아쉬워요! ${diffSeconds}초 차이! (+${earnedDdok}덕)`;
            messageClass = 'text-orange-400';
        }
        
        this.elements.resultText.textContent = message;
        this.elements.resultText.className = `result-text ${messageClass}`;
        
        // 결과 표시
        this.elements.resultContainer.classList.remove('hidden');
        this.elements.resultContainer.classList.add('show');
        
        // 3초 후 숨기기
        setTimeout(() => {
            this.elements.resultContainer.classList.add('hidden');
            this.elements.resultContainer.classList.remove('show');
        }, 3000);
    }
    
    animateButtonClick() {
        const button = this.elements.ddokButton;
        if (!button) return;
        
        // 클릭 효과
        button.style.transform = 'scale(0.95)';
        button.style.boxShadow = '0 2px 10px rgba(236, 72, 153, 0.8)';
        
        setTimeout(() => {
            button.style.transform = '';
            button.style.boxShadow = '';
        }, 150);
        
        // 리플 효과
        this.createRippleEffect(button);
    }
    
    createRippleEffect(element) {
        const ripple = document.createElement('div');
        ripple.style.position = 'absolute';
        ripple.style.borderRadius = '50%';
        ripple.style.background = 'rgba(255, 255, 255, 0.6)';
        ripple.style.transform = 'scale(0)';
        ripple.style.animation = 'ripple 0.6s linear';
        ripple.style.pointerEvents = 'none';
        
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = '50%';
        ripple.style.top = '50%';
        ripple.style.transform = 'translate(-50%, -50%) scale(0)';
        
        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);
        
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    }
    
    animateBannerClick() {
        const banner = this.elements.bannerImage;
        if (!banner) return;
        
        banner.style.transform = 'scale(0.98)';
        banner.style.filter = 'brightness(1.1)';
        
        setTimeout(() => {
            banner.style.transform = '';
            banner.style.filter = '';
        }, 200);
    }
    
    startDemoMode() {
        if (this.isGameActive) return;
        
        this.isGameActive = true;
        if (this.elements.demoBtn) {
            this.elements.demoBtn.textContent = '데모 진행중...';
            this.elements.demoBtn.disabled = true;
        }
        
        // 5초간 자동으로 덕 쌓기
        let demoCount = 0;
        const demoInterval = setInterval(() => {
            this.handleDdokClick({ preventDefault: () => {} });
            demoCount++;
            
            if (demoCount >= 5) {
                clearInterval(demoInterval);
                this.endDemoMode();
            }
        }, 1000);
    }
    
    endDemoMode() {
        this.isGameActive = false;
        if (this.elements.demoBtn) {
            this.elements.demoBtn.textContent = '데모 플레이';
            this.elements.demoBtn.disabled = false;
        }
        
        // 최종 결과 표시
        this.showFinalResult();
    }
    
    showFinalResult() {
        if (!this.elements.resultContainer || !this.elements.resultText) return;
        
        this.elements.resultText.textContent = `데모 완료! 총 ${this.currentScore}덕 획득!`;
        this.elements.resultContainer.classList.remove('hidden');
        this.elements.resultContainer.classList.add('show');
        
        setTimeout(() => {
            this.elements.resultContainer.classList.add('hidden');
            this.elements.resultContainer.classList.remove('show');
        }, 5000);
    }
    
    // 스크롤 애니메이션 트리거
    triggerScrollAnimation() {
        const container = document.querySelector('.ddokgame-container');
        if (!container) return;
        
        // 컨테이너 페이드 인
        container.style.opacity = '0';
        container.style.transform = 'translateY(30px)';
        container.style.transition = 'all 0.8s ease';
        
        setTimeout(() => {
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
        }, 100);
        
        // 요소들 순차 애니메이션
        const elements = [
            '.ddokgame-banner',
            '.member-card',
            '.target-time-container',
            '.current-time-container',
            '.ddok-button',
            '.total-ddok-card'
        ];
        
        elements.forEach((selector, index) => {
            const element = document.querySelector(selector);
            if (element) {
                setTimeout(() => {
                    element.style.opacity = '0';
                    element.style.transform = 'translateY(20px)';
                    element.style.transition = 'all 0.6s ease';
                    
                    setTimeout(() => {
                        element.style.opacity = '1';
                        element.style.transform = 'translateY(0)';
                    }, 50);
                }, 200 + (index * 100));
            }
        });
    }
    
    // 정리 함수
    destroy() {
        // 애니메이션 프레임 취소
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // 이벤트 리스너 제거
        if (this.elements.ddokButton) {
            this.elements.ddokButton.removeEventListener('click', this.handleDdokClick);
        }
        
        if (this.elements.demoBtn) {
            this.elements.demoBtn.removeEventListener('click', this.handleDemoClick);
        }
        
        if (this.elements.bannerImage) {
            this.elements.bannerImage.removeEventListener('click', this.handleBannerClick);
        }
        
        if (this.elements.memberImage) {
            this.elements.memberImage.removeEventListener('mouseenter', this.handleMemberHover);
            this.elements.memberImage.removeEventListener('mouseleave', this.handleMemberHover);
        }
        
        console.log('🎮 덕 쌓기 게임 인트로 정리 완료');
    }
}

// 전역 인스턴스
let ddokGameIntroSlide = null;

// 초기화 함수
function initDdokGameIntroSlide() {
    // DOM이 완전히 로드될 때까지 대기
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                if (!ddokGameIntroSlide) {
                    ddokGameIntroSlide = new DdokGameIntroSlide();
                }
            }, 100); // 100ms 지연으로 DOM 완전 로드 보장
        });
    } else {
        // 이미 로드된 경우 즉시 실행
        setTimeout(() => {
            if (!ddokGameIntroSlide) {
                ddokGameIntroSlide = new DdokGameIntroSlide();
            }
        }, 100);
    }
    return ddokGameIntroSlide;
}

// 정리 함수
function destroyDdokGameIntroSlide() {
    if (ddokGameIntroSlide) {
        ddokGameIntroSlide.destroy();
        ddokGameIntroSlide = null;
    }
}

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: translate(-50%, -50%) scale(4);
            opacity: 0;
        }
    }
    
    .ddokgame-slide-enter {
        animation: slideEnter 0.8s ease-out;
    }
    
    @keyframes slideEnter {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .score-bounce {
        animation: scoreBounce 0.5s ease;
    }
    
    @keyframes scoreBounce {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
    }
`;
document.head.appendChild(style);

// 전역 함수로 내보내기
window.DdokGameIntroSlide = DdokGameIntroSlide;
window.initDdokGameIntroSlide = initDdokGameIntroSlide;
window.destroyDdokGameIntroSlide = destroyDdokGameIntroSlide;
window.triggerDdokGameAnimation = () => {
    if (ddokGameIntroSlide) {
        ddokGameIntroSlide.triggerScrollAnimation();
    }
};