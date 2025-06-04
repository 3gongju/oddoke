// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 카페 데이터 로드
    const cafeDataScript = document.getElementById('cafes-data');
    if (cafeDataScript) {
        try {
            let rawData = JSON.parse(cafeDataScript.textContent);
            
            // 문자열이면 한 번 더 파싱
            if (typeof rawData === 'string') {
                rawData = JSON.parse(rawData);
            }
            
            // 배열인지 확인
            if (Array.isArray(rawData)) {
                window.cafesData = rawData;
            } else {
                window.cafesData = [];
            }
            
        } catch (e) {
            console.error('JSON 파싱 에러:', e);
            window.cafesData = [];
        }
    } else {
        window.cafesData = [];
    }
    
    // 위치 권한 확인
    const locationDenied = localStorage.getItem('locationDenied');
    
    if (locationDenied) {
        initMap();
    } else {
        showLocationModal();
    }
    
    // 이벤트 리스너 설정
    setupEventListeners();
    
    // UI 컴포넌트 초기화
    initFavoriteCarousel();
    initBirthdayNavigation();
    
    // 자동완성 초기화 (에러 처리 포함)
    if (typeof initAutocomplete === 'function') {
        try {
            initAutocomplete('ddok-search', 'ddok-autocomplete-list', {
                showBirthday: false,
                showArtistTag: true,
                submitOnSelect: true,
                artistOnly: false
            });
        } catch (error) {
            console.error('자동완성 초기화 실패:', error);
        }
    } else {
        console.warn('initAutocomplete 함수를 찾을 수 없습니다.');
    }
});

// 이벤트 리스너 설정
function setupEventListeners() {
    // 지도 관련 버튼
    document.getElementById('myLocationBtn').addEventListener('click', moveToMyLocation);
    document.getElementById('clusterToggle').addEventListener('click', toggleClustering);
    document.getElementById('closeCafeModal').addEventListener('click', closeCafeModal);
    
    // 모달 외부 클릭 시 닫기
    document.getElementById('cafeModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeCafeModal();
        }
    });
    
    // ✅ 찜하기 기능 - 완전히 제거하고 favorite.js에 위임
    // 찜하기는 이제 favorite.js에서만 처리됩니다
    console.log('찜하기 기능은 favorite.js에서 처리됩니다');
    
    // 리사이즈 이벤트
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (map) {
                map.relayout();
                if (clusterer) {
                    clusterer.clear();
                    createMarkers();
                }
            }
        }, 250);
    });
}