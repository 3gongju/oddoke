// static/js/post_form/member_select_all.js - 멤버 전체선택 전용 모듈

export class MemberSelectAllManager {
    constructor() {
        this.selectAllCheckbox = null;
        this.memberCheckboxes = [];
        this.isDebugMode = true; // 디버깅용
        
        // 바인딩된 핸들러 함수들 (removeEventListener를 위해)
        this.boundSelectAllHandler = this.handleSelectAllChange.bind(this);
        this.boundMemberHandler = this.handleMemberChange.bind(this);
        
        this.log('MemberSelectAllManager 초기화');
    }

    log(message, data = null) {
        if (this.isDebugMode) {
            console.log(`[MemberSelectAll] ${message}`, data || '');
        }
    }

    // 외부에서 호출하는 주요 메서드
    initialize() {
        this.log('initialize() 호출됨');
        
        // DOM이 준비된 후 실행
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupWithRetry();
            });
        } else {
            this.setupWithRetry();
        }
    }

    // 아티스트 변경 시 호출하는 메서드
    reinitializeForArtistChange() {
        this.log('reinitializeForArtistChange() 호출됨');
        
        // 기존 참조 초기화
        this.cleanup();
        
        // 멤버 로딩 완료를 기다리며 재시도
        this.setupWithRetry(10, 200); // 최대 10회, 200ms 간격
    }

    // 재시도 로직과 함께 설정
    setupWithRetry(maxRetries = 5, retryDelay = 300) {
        let retryCount = 0;
        
        const trySetup = () => {
            this.log(`설정 시도 ${retryCount + 1}/${maxRetries}`);
            
            if (this.setupSelectAll()) {
                this.log('✅ 설정 성공');
                return;
            }
            
            retryCount++;
            if (retryCount < maxRetries) {
                this.log(`⏳ ${retryDelay}ms 후 재시도...`);
                setTimeout(trySetup, retryDelay);
            } else {
                this.log('❌ 최대 재시도 횟수 초과');
            }
        };
        
        trySetup();
    }

    // 실제 설정 로직
    setupSelectAll() {
        // DOM 요소 찾기
        this.selectAllCheckbox = document.getElementById('select-all-members');
        this.memberCheckboxes = Array.from(document.querySelectorAll('.member-checkbox'));
        
        this.log('DOM 요소 확인', {
            selectAllCheckbox: !!this.selectAllCheckbox,
            memberCheckboxCount: this.memberCheckboxes.length
        });

        // 필수 요소 확인
        if (!this.selectAllCheckbox || this.memberCheckboxes.length === 0) {
            this.log('필수 요소가 없어서 설정 실패');
            return false;
        }

        // 기존 이벤트 리스너 제거
        this.removeEventListeners();
        
        // 새 이벤트 리스너 등록
        this.addEventListeners();
        
        // 초기 상태 설정
        this.updateSelectAllState();
        
        this.log('✅ 전체선택 기능 설정 완료');
        return true;
    }

    // 이벤트 리스너 제거
    removeEventListeners() {
        if (this.selectAllCheckbox) {
            this.selectAllCheckbox.removeEventListener('change', this.boundSelectAllHandler);
            this.log('전체선택 체크박스 이벤트 리스너 제거');
        }
        
        this.memberCheckboxes.forEach((checkbox, index) => {
            checkbox.removeEventListener('change', this.boundMemberHandler);
        });
        
        if (this.memberCheckboxes.length > 0) {
            this.log(`${this.memberCheckboxes.length}개 멤버 체크박스 이벤트 리스너 제거`);
        }
    }

    // 이벤트 리스너 추가
    addEventListeners() {
        if (this.selectAllCheckbox) {
            this.selectAllCheckbox.addEventListener('change', this.boundSelectAllHandler);
            this.log('전체선택 체크박스 이벤트 리스너 추가');
        }
        
        this.memberCheckboxes.forEach((checkbox, index) => {
            checkbox.addEventListener('change', this.boundMemberHandler);
        });
        
        this.log(`${this.memberCheckboxes.length}개 멤버 체크박스 이벤트 리스너 추가`);
    }

    // 전체선택 체크박스 변경 핸들러
    handleSelectAllChange() {
        const isChecked = this.selectAllCheckbox.checked;
        this.log('전체선택 변경', { checked: isChecked });
        
        this.memberCheckboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
        });
    }

    // 개별 멤버 체크박스 변경 핸들러
    handleMemberChange() {
        this.log('개별 멤버 선택 변경');
        this.updateSelectAllState();
    }

    // 전체선택 체크박스 상태 업데이트
    updateSelectAllState() {
        if (!this.selectAllCheckbox || this.memberCheckboxes.length === 0) {
            return;
        }
        
        const checkedCount = this.memberCheckboxes.filter(cb => cb.checked).length;
        const totalCount = this.memberCheckboxes.length;
        
        this.log('상태 업데이트', { 
            checked: checkedCount, 
            total: totalCount 
        });

        if (checkedCount === 0) {
            this.selectAllCheckbox.indeterminate = false;
            this.selectAllCheckbox.checked = false;
        } else if (checkedCount === totalCount) {
            this.selectAllCheckbox.indeterminate = false;
            this.selectAllCheckbox.checked = true;
        } else {
            this.selectAllCheckbox.indeterminate = true;
            this.selectAllCheckbox.checked = false;
        }
    }

    // 정리 작업
    cleanup() {
        this.log('cleanup() 호출됨');
        this.removeEventListeners();
        this.selectAllCheckbox = null;
        this.memberCheckboxes = [];
    }

    // 디버그 모드 토글
    setDebugMode(enabled) {
        this.isDebugMode = enabled;
    }
}

// 전역 인스턴스 생성 및 내보내기
const memberSelectAllManager = new MemberSelectAllManager();

// 전역 접근을 위해 window 객체에도 등록
window.memberSelectAllManager = memberSelectAllManager;

export default memberSelectAllManager;