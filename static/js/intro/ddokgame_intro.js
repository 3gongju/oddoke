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
        
        // 태용의 생일로 설정 (7월 1일)
        this.targetTime.setHours(13, 29, 14, 0); // 13:29:14로 고정
        
        this.init();
    }
    
    init() {
        console.log('🎮 덕 쌓기 게임 인트로 초기화');
        
        this.setupElements();
        this.setupEventListeners();
        this.startTimeDisplay();
        this.setupTargetTime();
        
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
    }
    
    setupEventListeners() {
        // 덕 쌓기 버튼
        if (this.elements.ddokButton) {
            this.elements.ddokButton.addEventListener('click', (e) => this.handleDdokClick(e));
        }
        
        // 데모 버튼
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
        if (this.elements.targetTimeDisplay) {
            this.elements.targetTimeDisplay.textContent = '13:29:14';
        }
    }
    
    startTimeDisplay() {
        // 즉시 첫 번째 시간 업데이트
        this.updateCurrentTime();
        
        const updateTime = () => {
            this.updateCurrentTime();
            this.animationFrameId = requestAnimationFrame(updateTime);
        };
        
        // requestAnimationFrame으로 부드러운 업데이트
        this.animationFrameId = requestAnimationFrame(updateTime);
    }
    
    updateCurrentTime() {
        const now = new Date();
        
        // 현재 시간 표시 (한국 시간 기준)
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
        
        // DOM 요소가 존재하는지 확인 후 업데이트
        if (this.elements.currentTimeMain) {
            this.elements.currentTimeMain.textContent = `${hours}:${minutes}:${seconds}`;
        }
        
        if (this.elements.currentTimeMs) {
            this.elements.currentTimeMs.textContent = `.${milliseconds}`;
        }
        
        // 디버깅용 로그 (필요시)
        // console.log(`시간 업데이트: ${hours}:${minutes}:${seconds}.${milliseconds}`);
    }
    
    handleDdokClick(event) {
        event.preventDefault();
        
        // 클릭 애니메이션
        this.animateButtonClick();
        
        // 점수 계산 (랜덤으로 데모용)
        const earnedDdok = this.calculateDdok();
        this.currentScore += earnedDdok;
        
        // UI 업데이트
        this.updateScore();
        this.showResult(earnedDdok);
        
        console.log(`🎮 덕 쌓기! +${earnedDdok}덕 획득`);
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
    
    calculateDdok() {
        // 실제 게임에서는 정확도에 따라 계산
        // 데모용으로 랜덤 점수
        const scores = [10, 25, 50, 75, 100];
        return scores[Math.floor(Math.random() * scores.length)];
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
    
    showResult(earnedDdok) {
        if (!this.elements.resultContainer || !this.elements.resultText) return;
        
        // 결과 메시지 설정
        const messages = {
            10: '좋아요! +10덕 획득!',
            25: '잘했어요! +25덕 획득!',
            50: '완벽해요! +50덕 획득!',
            75: '대박! +75덕 획득!',
            100: '전설이에요! +100덕 획득!'
        };
        
        this.elements.resultText.textContent = messages[earnedDdok] || `+${earnedDdok}덕 획득!`;
        
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
        this.elements.demoBtn.textContent = '데모 진행중...';
        this.elements.demoBtn.disabled = true;
        
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
        this.elements.demoBtn.textContent = '데모 플레이';
        this.elements.demoBtn.disabled = false;
        
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
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        // 이벤트 리스너 제거
        if (this.elements.ddokButton) {
            this.elements.ddokButton.removeEventListener('click', this.handleDdokClick);
        }
        
        console.log('🎮 덕 쌓기 게임 인트로 정리 완료');
    }
}

// 전역 인스턴스
let ddokGameIntroSlide = null;

// 초기화 함수
function initDdokGameIntroSlide() {
    if (!ddokGameIntroSlide) {
        ddokGameIntroSlide = new DdokGameIntroSlide();
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