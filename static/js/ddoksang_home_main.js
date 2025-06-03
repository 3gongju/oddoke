// static/js/ddoksang_home_main.js - 찜하기 기능 제거한 버전

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

// 이벤트 리스너 설정 (찜하기 기능 제거)
function setupEventListeners() {
    // 지도 관련 버튼
    const myLocationBtn = document.getElementById('myLocationBtn');
    const clusterToggle = document.getElementById('clusterToggle');
    const closeCafeModal = document.getElementById('closeCafeModal');
    
    if (myLocationBtn) {
        myLocationBtn.addEventListener('click', moveToMyLocation);
    }
    
    if (clusterToggle) {
        clusterToggle.addEventListener('click', toggleClustering);
    }
    
    if (closeCafeModal) {
        closeCafeModal.addEventListener('click', closeCafeModal);
    }
    
    // 위치 모달 버튼들
    const allowLocationBtn = document.getElementById('allowLocationBtn');
    const denyLocationBtn = document.getElementById('denyLocationBtn');
    
    if (allowLocationBtn) {
        allowLocationBtn.addEventListener('click', function() {
            const modal = document.getElementById('locationModal');
            if (modal) {
                modal.classList.add('hidden');
            }
            requestUserLocation();
        });
    }
    
    if (denyLocationBtn) {
        denyLocationBtn.addEventListener('click', function() {
            const modal = document.getElementById('locationModal');
            if (modal) {
                modal.classList.add('hidden');
            }
            localStorage.setItem('locationDenied', 'true');
            initMap();
        });
    }
    
    // 모달 외부 클릭 시 닫기
    const cafeModal = document.getElementById('cafeModal');
    if (cafeModal) {
        cafeModal.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                closeCafeModal();
            }
        });
    }
    
    // 리사이즈 이벤트
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (window.map) {
                window.map.relayout();
                if (window.clusterer) {
                    window.clusterer.clear();
                    createMarkers();
                }
            }
        }, 250);
    });
}

// 위치 관련 함수들
function requestUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                initMap({ lat: userLat, lng: userLng });
            },
            (error) => {
                console.warn('위치 정보 가져오기 실패:', error);
                initMap();
            }
        );
    } else {
        console.warn('이 브라우저에서는 위치 서비스를 지원하지 않습니다.');
        initMap();
    }
}

function showLocationModal() {
    const modal = document.getElementById('locationModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeCafeModal() {
    const modal = document.getElementById('cafeModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// 내 위치로 이동
function moveToMyLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                if (window.map) {
                    const moveLatLng = new kakao.maps.LatLng(lat, lng);
                    window.map.setCenter(moveLatLng);
                    window.map.setLevel(6);
                    
                    // 내 위치 마커 표시
                    if (window.userLocationMarker) {
                        window.userLocationMarker.setMap(null);
                    }
                    
                    window.userLocationMarker = new kakao.maps.Marker({
                        position: moveLatLng,
                        map: window.map
                    });
                }
            },
            (error) => {
                console.error('위치 정보 가져오기 실패:', error);
                alert('위치 정보를 가져올 수 없습니다.');
            }
        );
    } else {
        alert('이 브라우저에서는 위치 서비스를 지원하지 않습니다.');
    }
}

// 클러스터링 토글
function toggleClustering() {
    const button = document.getElementById('clusterToggle');
    if (!button || !window.clusterer || !window.markers) return;
    
    if (window.isClusteringEnabled) {
        // 클러스터링 비활성화
        window.clusterer.clear();
        window.markers.forEach(marker => marker.setMap(window.map));
        button.textContent = '🔗 클러스터링 OFF';
        button.classList.remove('bg-gray-600', 'hover:bg-gray-700');
        button.classList.add('bg-red-600', 'hover:bg-red-700');
        window.isClusteringEnabled = false;
    } else {
        // 클러스터링 활성화
        window.markers.forEach(marker => marker.setMap(null));
        window.clusterer.addMarkers(window.markers);
        button.textContent = '🔗 클러스터링 ON';
        button.classList.remove('bg-red-600', 'hover:bg-red-700');
        button.classList.add('bg-gray-600', 'hover:bg-gray-700');
        window.isClusteringEnabled = true;
    }
}

// UI 컴포넌트 초기화 함수들
function initFavoriteCarousel() {
    const carousel = document.getElementById('favoriteCarousel');
    if (!carousel) return;
    
    // 찜한 카페 캐러셀의 스크롤 동작 최적화
    let isScrolling = false;
    
    carousel.addEventListener('scroll', () => {
        if (!isScrolling) {
            window.requestAnimationFrame(() => {
                // 스크롤 위치에 따른 인디케이터 업데이트 등
                isScrolling = false;
            });
            isScrolling = true;
        }
    });
}

function initBirthdayNavigation() {
    const slider = document.getElementById('birthdaySlider');
    const prevBtn = document.getElementById('birthdayPrevBtn');
    const nextBtn = document.getElementById('birthdayNextBtn');
    const indicators = document.getElementById('birthdayIndicators');
    
    if (!slider || !prevBtn || !nextBtn) return;
    
    let currentSlide = 0;
    const slides = slider.children;
    const totalSlides = slides.length;
    
    if (totalSlides === 0) return;
    
    // 인디케이터 생성
    if (indicators && totalSlides > 1) {
        for (let i = 0; i < totalSlides; i++) {
            const dot = document.createElement('button');
            dot.className = `w-2 h-2 rounded-full transition-colors ${i === 0 ? 'bg-gray-800' : 'bg-gray-300'}`;
            dot.addEventListener('click', () => goToSlide(i));
            indicators.appendChild(dot);
        }
    }
    
    function updateSlider() {
        const translateX = -currentSlide * 100;
        slider.style.transform = `translateX(${translateX}%)`;
        
        // 버튼 상태 업데이트
        prevBtn.disabled = currentSlide === 0;
        nextBtn.disabled = currentSlide === totalSlides - 1;
        
        // 인디케이터 업데이트
        if (indicators) {
            const dots = indicators.children;
            for (let i = 0; i < dots.length; i++) {
                dots[i].className = `w-2 h-2 rounded-full transition-colors ${i === currentSlide ? 'bg-gray-800' : 'bg-gray-300'}`;
            }
        }
    }
    
    function goToSlide(index) {
        currentSlide = Math.max(0, Math.min(index, totalSlides - 1));
        updateSlider();
    }
    
    // 이벤트 리스너
    prevBtn.addEventListener('click', () => {
        if (currentSlide > 0) {
            goToSlide(currentSlide - 1);
        }
    });
    
    nextBtn.addEventListener('click', () => {
        if (currentSlide < totalSlides - 1) {
            goToSlide(currentSlide + 1);
        }
    });
    
    // 초기 상태 설정
    updateSlider();
}

// 아티스트 검색 함수
function searchArtist(artistName) {
    const searchForm = document.querySelector('form[action*="search"]');
    const searchInput = document.querySelector('#ddok-search');
    
    if (searchInput && searchForm) {
        searchInput.value = artistName;
        searchForm.submit();
    }
}

// 지도 초기화 함수 (maps.js에서 정의되지 않은 경우를 위한 fallback)
function initMap(userLocation = null) {
    if (typeof window.initMapFunction === 'function') {
        window.initMapFunction(userLocation);
    } else {
        console.warn('지도 초기화 함수를 찾을 수 없습니다. maps.js가 로드되었는지 확인하세요.');
    }
}

// 전역 함수로 노출 (다른 스크립트에서 사용할 수 있도록)
window.ddoksangHome = {
    initFavoriteCarousel,
    initBirthdayNavigation,
    searchArtist,
    moveToMyLocation,
    toggleClustering,
    requestUserLocation
};