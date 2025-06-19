// 중복 확인 로직 및 UI 관리

/**
 * 중복 확인 관리자
 */
window.DuplicateChecker = {
    
    // 상태 관리
    state: {
        isChecking: false,
        isDuplicate: false,
        duplicateChecked: false,
        currentResults: []
    },

    // DOM 요소 캐시
    elements: {
        get duplicateResults() { return document.getElementById('duplicate-results'); },
        get cardsContainer() { return document.getElementById('cafe-cards-container'); },
        get checkButton() { return document.getElementById('check-duplicate-btn'); }
    },

    /**
     * 🔍 중복 확인 API 호출
     */
    async performCheck(formData) {
        this.state.isChecking = true;
        this.updateButtonState();
        
        try {
            console.log('🔍 중복 확인 시작:', formData);
            
            // URL 파라미터 생성
            const params = new URLSearchParams();
            if (formData.artist_id) params.append('artist_id', formData.artist_id);
            if (formData.member_id) params.append('member_id', formData.member_id);
            if (formData.cafe_name) params.append('cafe_name', formData.cafe_name);
            if (formData.start_date) params.append('start_date', formData.start_date);
            if (formData.end_date) params.append('end_date', formData.end_date);
            
            const url = `/ddoksang/cafe/check-duplicate/?${params.toString()}`;
            console.log('🌐 API URL:', url);
            
            // API 호출
            const response = await fetch(url);
            const data = await response.json();
            
            console.log('🔍 중복 확인 API 응답 전체:', data);
            
            // 디버깅 정보 출력
            this.logDebugInfo(data);
            
            // 결과 처리
            const hasSimilarCafes = this.processDuplicateResponse(data);
            
            if (hasSimilarCafes) {
                // 중복 카페 발견
                this.handleDuplicateFound(data);
            } else {
                // 중복 없음
                this.handleNoDuplicate();
            }
            
        } catch (error) {
            console.error('❌ 중복 확인 오류:', error);
            this.handleError(error);
        } finally {
            this.state.isChecking = false;
            this.updateButtonState();
        }
    },

    /**
     * 📊 API 응답 처리
     */
    processDuplicateResponse(data) {
        // 여러 가지 경우를 모두 확인 (하위 호환성)
        const hasSimilarCafes = (
            (data.exists && data.similar_cafes && data.similar_cafes.length > 0) ||
            (data.exists && data.duplicates && data.duplicates.length > 0) ||
            (data.exists && data.similar_count > 0)
        );
        
        // 결과 저장
        this.state.currentResults = data.similar_cafes || data.duplicates || [];
        
        return hasSimilarCafes;
    },

    /**
     * 🚨 중복 카페 발견 시 처리
     */
    handleDuplicateFound(data) {
        console.log('🚨 중복 카페 발견:', this.state.currentResults);
        
        this.state.isDuplicate = true;
        this.state.duplicateChecked = true;
        
        this.showDuplicateCafes(this.state.currentResults);
        
        // 토스트 메시지
        if (window.showWarningToast) {
            window.showWarningToast(
                `${this.state.currentResults.length}개의 유사한 생카가 발견되었습니다.`, 
                3000
            );
        }
    },

    /**
     * ✅ 중복 없음 처리
     */
    handleNoDuplicate() {
        console.log('✅ 중복 없음 - 새로운 등록 진행');
        
        this.state.isDuplicate = false;
        this.state.duplicateChecked = true;
        this.state.currentResults = [];
        
        this.hideDuplicateResults();
        
        // 토스트 메시지
        if (window.showSuccessToast) {
            window.showSuccessToast('중복 확인 완료! 새로운 생카를 등록할 수 있습니다.', 2000);
        }
        
        // 메인 로직에 알림 (다음 단계로 이동)
        if (window.DdoksangCreate && window.DdoksangCreate.onDuplicateCheckSuccess) {
            window.DdoksangCreate.onDuplicateCheckSuccess();
        }
    },

    /**
     * ❌ 오류 처리
     */
    handleError(error) {
        console.error('❌ 중복 확인 실패:', error);
        
        if (window.showErrorToast) {
            window.showErrorToast('중복 확인 중 오류가 발생했습니다. 다시 시도해주세요.', 5000);
        }
        
        this.hideDuplicateResults();
    },

    /**
     * 🎴 중복 카페 카드 표시
     */
    showDuplicateCafes(cafes) {
        const { duplicateResults, cardsContainer } = this.elements;
        
        if (!duplicateResults || !cardsContainer) {
            console.error('❌ 중복 결과 표시 요소를 찾을 수 없습니다.');
            return;
        }
        
        // 카드 템플릿 사용
        if (window.DuplicateCardTemplate) {
            const cardsHtml = window.DuplicateCardTemplate.createCards(cafes);
            cardsContainer.innerHTML = cardsHtml;
        } else {
            console.error('❌ DuplicateCardTemplate이 로드되지 않았습니다.');
            cardsContainer.innerHTML = '<p class="text-red-500">카드 템플릿을 로드할 수 없습니다.</p>';
        }
        
        // 결과 영역 표시
        duplicateResults.classList.remove('hidden');
        
        // 스크롤 애니메이션
        setTimeout(() => {
            duplicateResults.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest' 
            });
        }, 100);
    },

    /**
     * 🫥 중복 결과 숨기기
     */
    hideDuplicateResults() {
        const { duplicateResults, cardsContainer } = this.elements;
        
        if (duplicateResults) {
            duplicateResults.classList.add('hidden');
        }
        
        if (cardsContainer) {
            cardsContainer.innerHTML = '';
        }
    },

    /**
     * 🔘 버튼 상태 업데이트
     */
    updateButtonState() {
        const button = this.elements.checkButton;
        if (!button) return;
        
        if (this.state.isChecking) {
            button.disabled = true;
            button.textContent = '확인 중...';
            button.className = 'w-full px-6 py-3 bg-gray-400 text-gray-200 rounded-lg cursor-not-allowed font-medium';
        } else {
            button.disabled = false;
            button.textContent = '중복 확인하기';
            // 원래 상태로 복원 (다른 로직에서 관리)
        }
    },

    /**
     * 🐛 디버깅 정보 출력
     */
    logDebugInfo(data) {
        console.log('📊 응답 분석:', {
            exists: data.exists,
            similar_cafes: data.similar_cafes,
            similar_count: data.similar_count,
            duplicates: data.duplicates, // 하위 호환성
            debug_info: data.debug_info
        });
        
        // 개발 환경에서 디버깅 정보 표시
        if (data.debug_info) {
            console.group('🔍 중복 확인 디버깅 정보');
            console.log('정규화된 입력:', data.debug_info.normalized_input);
            console.log('기존 카페 수:', data.debug_info.existing_cafes_count);
            console.log('유사도 임계값:', data.debug_info.similarity_threshold);
            console.log('검색 조건:', data.debug_info.search_conditions);
            console.groupEnd();
        }
    },

    /**
     * 🗂️ 상태 정보 반환
     */
    getState() {
        return { ...this.state };
    },

    /**
     * 🔄 상태 초기화
     */
    resetState() {
        this.state = {
            isChecking: false,
            isDuplicate: false,
            duplicateChecked: false,
            currentResults: []
        };
        
        this.hideDuplicateResults();
        console.log('🔄 중복 확인 상태 초기화');
    },

    /**
     * 🎯 빠른 접근 함수들 (하위 호환성)
     */
    isDuplicateChecked() {
        return this.state.duplicateChecked;
    },

    hasDuplicates() {
        return this.state.isDuplicate;
    }
};

// 전역 함수로 노출 (하위 호환성)
window.showDuplicateCafes = function(cafes) {
    window.DuplicateChecker.showDuplicateCafes(cafes);
};

window.performDuplicateCheck = function() {
    // 폼 데이터 수집
    const formData = {
        artist_id: document.getElementById('check_artist_id')?.value?.trim(),
        member_id: document.getElementById('check_member_id')?.value?.trim(),
        cafe_name: document.getElementById('check_cafe_name')?.value?.trim(),
        start_date: document.getElementById('check_start_date')?.value?.trim(),
        end_date: document.getElementById('check_end_date')?.value?.trim()
    };
    
    window.DuplicateChecker.performCheck(formData);
};

console.log('🔍 DuplicateChecker 로드 완료');