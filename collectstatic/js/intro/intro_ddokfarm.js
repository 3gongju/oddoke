// C:\Users\1-17\Desktop\DAMF2\oddoke\static\js\intro\intro_ddokfarm.js

/**
 * 덕팜 인트로 폼 인터랙션 관리
 */
class DdokfarmIntroForm {
    constructor() {
        this.isInitialized = false;
        this.animationDelay = 150; // ms
        this.init();
    }

    /**
     * 초기화
     */
    init() {
        if (this.isInitialized) return;
        
        console.log('🎯 DdokfarmIntroForm 초기화 시작');
        
        // DOM이 준비되면 이벤트 리스너 설정
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
        
        this.isInitialized = true;
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 라디오 버튼 이벤트
        this.setupRadioEvents();
        
        // 체크박스 이벤트
        this.setupCheckboxEvents();
        
        // 키보드 접근성
        this.setupKeyboardEvents();
        
        // 애니메이션 효과
        this.setupAnimations();
        
        console.log('✅ DdokfarmIntroForm 이벤트 리스너 설정 완료');
    }

    /**
     * 라디오 버튼 이벤트 설정
     */
    setupRadioEvents() {
        const radioGroups = ['want_to', 'condition', 'shipping'];
        
        radioGroups.forEach(groupName => {
            const radios = document.querySelectorAll(`input[name="${groupName}"]`);
            
            radios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    this.handleRadioChange(e, groupName);
                });
                
                // 라벨 클릭 효과
                const label = radio.closest('label');
                if (label) {
                    label.addEventListener('click', () => {
                        this.addClickEffect(label);
                    });
                }
            });
        });
    }

    /**
     * 체크박스 이벤트 설정
     */
    setupCheckboxEvents() {
        const checkboxes = document.querySelectorAll('input[name="md"]');
        
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.handleCheckboxChange(e);
            });
            
            // 라벨 클릭 효과
            const label = checkbox.closest('label');
            if (label) {
                label.addEventListener('click', () => {
                    this.addClickEffect(label);
                });
            }
        });
    }

    /**
     * 키보드 접근성 설정
     */
    setupKeyboardEvents() {
        const inputs = document.querySelectorAll('.ddokfarm-radio, .ddokfarm-checkbox');
        
        inputs.forEach(input => {
            // 스페이스바로 선택
            input.addEventListener('keydown', (e) => {
                if (e.key === ' ') {
                    e.preventDefault();
                    
                    if (input.type === 'radio') {
                        input.checked = true;
                        input.dispatchEvent(new Event('change'));
                    } else if (input.type === 'checkbox') {
                        input.checked = !input.checked;
                        input.dispatchEvent(new Event('change'));
                    }
                    
                    this.addClickEffect(input.closest('label'));
                }
            });
            
            // 화살표 키로 라디오 그룹 내 이동
            input.addEventListener('keydown', (e) => {
                if (input.type === 'radio' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    e.preventDefault();
                    this.navigateRadioGroup(input, e.key === 'ArrowDown');
                }
            });
        });
    }

    /**
     * 애니메이션 효과 설정
     */
    setupAnimations() {
        // 섹션별 순차 애니메이션
        const sections = document.querySelectorAll('.ddokfarm-form-section');
        
        // Intersection Observer로 뷰포트 진입시 애니메이션
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }, index * this.animationDelay);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px'
        });

        sections.forEach((section, index) => {
            // 초기 상태 설정
            section.style.opacity = '0';
            section.style.transform = 'translateY(20px)';
            section.style.transition = 'all 0.6s ease';
            
            observer.observe(section);
        });
    }

    /**
     * 라디오 버튼 변경 처리
     */
    handleRadioChange(event, groupName) {
        const selectedValue = event.target.value;
        const selectedText = event.target.closest('label').textContent.trim();
        
        console.log(`📻 ${groupName} 선택: ${selectedValue} (${selectedText})`);
        
        // 선택된 라벨에 효과 추가
        this.highlightSelection(event.target);
        
        // 커스텀 이벤트 발생
        this.dispatchCustomEvent('ddokfarm-radio-change', {
            group: groupName,
            value: selectedValue,
            text: selectedText
        });
    }

    /**
     * 체크박스 변경 처리
     */
    handleCheckboxChange(event) {
        const value = event.target.value;
        const text = event.target.closest('label').textContent.trim();
        const isChecked = event.target.checked;
        
        console.log(`☑️ 종류 ${isChecked ? '선택' : '해제'}: ${value} (${text})`);
        
        // 선택된 라벨에 효과 추가
        this.highlightSelection(event.target);
        
        // 현재 선택된 모든 체크박스 값들
        const checkedValues = Array.from(document.querySelectorAll('input[name="md"]:checked'))
            .map(cb => cb.value);
        
        // 커스텀 이벤트 발생
        this.dispatchCustomEvent('ddokfarm-checkbox-change', {
            value: value,
            text: text,
            isChecked: isChecked,
            allChecked: checkedValues
        });
    }

    /**
     * 라디오 그룹 내 키보드 탐색
     */
    navigateRadioGroup(currentRadio, isDown) {
        const groupName = currentRadio.name;
        const radios = Array.from(document.querySelectorAll(`input[name="${groupName}"]`));
        const currentIndex = radios.indexOf(currentRadio);
        
        let nextIndex;
        if (isDown) {
            nextIndex = (currentIndex + 1) % radios.length;
        } else {
            nextIndex = currentIndex === 0 ? radios.length - 1 : currentIndex - 1;
        }
        
        const nextRadio = radios[nextIndex];
        nextRadio.focus();
        nextRadio.checked = true;
        nextRadio.dispatchEvent(new Event('change'));
    }

    /**
     * 선택 하이라이트 효과
     */
    highlightSelection(input) {
        const label = input.closest('label');
        if (!label) return;
        
        // 펄스 효과
        label.style.transform = 'scale(1.05)';
        setTimeout(() => {
            label.style.transform = 'scale(1)';
        }, 150);
    }

    /**
     * 클릭 효과 추가
     */
    addClickEffect(element) {
        if (!element) return;
        
        element.classList.add('ddokfarm-click-effect');
        setTimeout(() => {
            element.classList.remove('ddokfarm-click-effect');
        }, 300);
    }

    /**
     * 커스텀 이벤트 발생
     */
    dispatchCustomEvent(eventName, detail) {
        const event = new CustomEvent(eventName, {
            detail: detail,
            bubbles: true,
            cancelable: true
        });
        
        document.dispatchEvent(event);
    }

    /**
     * 현재 선택된 모든 값들 반환
     */
    getSelectedValues() {
        const wantTo = document.querySelector('input[name="want_to"]:checked')?.value;
        const condition = document.querySelector('input[name="condition"]:checked')?.value;
        const shipping = document.querySelector('input[name="shipping"]:checked')?.value;
        const mdTypes = Array.from(document.querySelectorAll('input[name="md"]:checked'))
            .map(cb => cb.value);
        
        return {
            wantTo,
            condition,
            shipping,
            mdTypes
        };
    }

    /**
     * 폼 초기화
     */
    resetForm() {
        // 모든 라디오 버튼을 첫 번째로 설정
        const radioGroups = ['want_to', 'condition', 'shipping'];
        radioGroups.forEach(group => {
            const firstRadio = document.querySelector(`input[name="${group}"]`);
            if (firstRadio) {
                firstRadio.checked = true;
            }
        });
        
        // 모든 체크박스 해제
        const checkboxes = document.querySelectorAll('input[name="md"]');
        checkboxes.forEach(cb => cb.checked = false);
        
        console.log('🔄 덕팜 폼 초기화 완료');
    }

    /**
     * 디버깅용 - 현재 상태 출력
     */
    logCurrentState() {
        const values = this.getSelectedValues();
        console.log('📊 현재 덕팜 폼 상태:', values);
        return values;
    }
}

// CSS 클릭 효과 추가
const clickEffectCSS = `
.ddokfarm-click-effect {
    background: rgba(236, 72, 153, 0.3) !important;
    transform: scale(1.02) !important;
}
`;

// 스타일 주입
if (!document.getElementById('ddokfarm-click-effect-styles')) {
    const style = document.createElement('style');
    style.id = 'ddokfarm-click-effect-styles';
    style.textContent = clickEffectCSS;
    document.head.appendChild(style);
}

// 글로벌 인스턴스 생성 및 내보내기
window.DdokfarmIntroForm = DdokfarmIntroForm;

// 페이지 로드시 자동 초기화
if (typeof window !== 'undefined') {
    window.ddokfarmForm = new DdokfarmIntroForm();
}

// 디버깅용 전역 함수들
window.getDdokfarmState = () => window.ddokfarmForm?.getSelectedValues();
window.resetDdokfarmForm = () => window.ddokfarmForm?.resetForm();

console.log('intro_ddokfarm.js 로드 완료');