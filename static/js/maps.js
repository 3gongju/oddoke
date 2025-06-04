// 통합된 maps.js - 모든 지도 기능 포함
// 전역 변수
let map;
let clusterer;
let markers = [];
let userLocationMarker = null;
let isClusteringEnabled = true;
let userLocation = null;

console.log('maps.js 로드 시작');

// ✅ 메인 지도 초기화 함수 (home.html 전용)
function initMap(centerLat = 37.5665, centerLng = 126.9780, userLocationData = null) {
    try {
        console.log('지도 초기화 시작:', centerLat, centerLng);

        if (typeof kakao === 'undefined' || typeof kakao.maps === 'undefined') {
            console.error('카카오맵 API가 로드되지 않았습니다.');
            showMapError('카카오맵 API를 불러올 수 없습니다.');
            return;
        }

        const mapContainer = document.getElementById('mapContainer');
        if (!mapContainer) {
            console.error('지도 컨테이너를 찾을 수 없습니다.');
            return;
        }

        if (userLocationData?.lat && userLocationData?.lng) {
            centerLat = userLocationData.lat;
            centerLng = userLocationData.lng;
            console.log('사용자 위치로 지도 중심 설정:', centerLat, centerLng);
        }

        const mapOption = {
            center: new kakao.maps.LatLng(centerLat, centerLng),
            level: window.innerWidth < 768 ? 9 : 8
        };

        map = new kakao.maps.Map(mapContainer, mapOption);
        window.map = map;
        console.log('지도 생성 완료');

        createClusterer();

        setTimeout(() => {
            hideMapLoading();
            createMarkers();
            map.relayout();

            if (userLocationData?.lat && userLocationData?.lng) {
                addUserLocationMarker(userLocationData.lat, userLocationData.lng);
            }

            console.log('지도 초기화 완료');
        }, 500);

    } catch (error) {
        console.error('지도 초기화 중 오류 발생:', error);
        showMapError(`지도 초기화 실패: ${error.message}`);
    }
}

function createClusterer() {
    if (typeof kakao.maps.MarkerClusterer !== 'undefined') {
        clusterer = new kakao.maps.MarkerClusterer({
            map: map,
            averageCenter: true,
            minLevel: window.innerWidth < 768 ? 7 : 6,
            disableClickZoom: true
        });
        window.clusterer = clusterer;

        kakao.maps.event.addListener(clusterer, 'clusterclick', (cluster) => {
            map.setLevel(map.getLevel() - 2, { anchor: cluster.getCenter() });
        });
    }
}

function createMarkers() {
    markers = [];
    if (!window.cafesData?.length) {
        updateCafeCount(0);
        return;
    }

    window.cafesData.forEach(cafe => {
        if (!cafe.latitude || !cafe.longitude) return;
        const position = new kakao.maps.LatLng(+cafe.latitude, +cafe.longitude);
        const markerImage = createCustomMarkerImage(cafe);

        const marker = new kakao.maps.Marker({
            position, image: markerImage,
            title: cafe.cafe_name || cafe.name || '생일카페'
        });

        kakao.maps.event.addListener(marker, 'click', () => {
            showCafeModal(cafe);
            map.setCenter(position);
            if (map.getLevel() > 5) map.setLevel(5);
        });

        markers.push(marker);
    });

    displayMarkers();
    updateCafeCount(markers.length);
}

function createCustomMarkerImage(cafe) {
    const markerSize = window.innerWidth < 768 ? 24 : 32;
    const svg = `
        <svg xmlns='http://www.w3.org/2000/svg' width='${markerSize}' height='${markerSize + 8}' viewBox='0 0 ${markerSize} ${markerSize + 8}'>
            <path d='M${markerSize/2} 0C${markerSize * 0.3} 0 0 ${markerSize * 0.3} 0 ${markerSize/2}s${markerSize/2} ${markerSize * 0.7} ${markerSize/2} ${markerSize * 0.7} ${markerSize/2}-${markerSize * 0.2} ${markerSize/2}-${markerSize/2}S${markerSize * 0.7} 0 ${markerSize/2} 0z' fill='#ef4444'/>
            <circle cx='${markerSize/2}' cy='${markerSize/2}' r='${markerSize * 0.25}' fill='white'/>
            <text x='${markerSize/2}' y='${markerSize/2 + 3}' text-anchor='middle' font-family='Arial' font-size='${markerSize * 0.3}' fill='#ef4444'>🎂</text>
        </svg>`;
    const imageSize = new kakao.maps.Size(markerSize, markerSize + 8);
    return new kakao.maps.MarkerImage(`data:image/svg+xml;base64,${btoa(svg)}`, imageSize, {
        offset: new kakao.maps.Point(markerSize/2, markerSize + 8)
    });
}

function displayMarkers() {
    if (markers.length === 0) return;
    isClusteringEnabled && clusterer ? clusterer.addMarkers(markers) : markers.forEach(m => m.setMap(map));
}

function addUserLocationMarker(lat, lng) {
    const position = new kakao.maps.LatLng(lat, lng);
    const markerSize = window.innerWidth < 768 ? 16 : 20;
    const svg = `
        <svg xmlns='http://www.w3.org/2000/svg' width='${markerSize}' height='${markerSize}' viewBox='0 0 ${markerSize} ${markerSize}'>
            <circle cx='${markerSize/2}' cy='${markerSize/2}' r='${markerSize*0.4}' fill='#3b82f6' stroke='white' stroke-width='2'/>
            <circle cx='${markerSize/2}' cy='${markerSize/2}' r='${markerSize*0.15}' fill='white'/>
        </svg>`;
    const imageSize = new kakao.maps.Size(markerSize, markerSize);
    const markerImage = new kakao.maps.MarkerImage(`data:image/svg+xml;base64,${btoa(svg)}`, imageSize);

    userLocationMarker?.setMap(null);
    userLocationMarker = new kakao.maps.Marker({ map, position, image: markerImage, title: '내 위치' });
    userLocation = { lat, lng };
    showNearbyCafes(lat, lng);
}


// ✅ 내 위치로 이동
function moveToMyLocation() {
    const btn = document.getElementById('myLocationBtn');
    if (!btn) return;
    
    const originalContent = btn.innerHTML;
    
    btn.innerHTML = `
        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        <span class="hidden sm:inline">위치 찾는 중...</span>
    `;
    btn.disabled = true;
    
    const restoreButton = (success = false) => {
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.disabled = false;
            
            if (success) {
                btn.classList.add('bg-green-600');
                setTimeout(() => {
                    btn.classList.remove('bg-green-600');
                    btn.classList.add('bg-blue-600');
                }, 1500);
            }
        }, 100);
    };
    
    // 이미 사용자 위치가 있으면 해당 위치로 이동
    if (userLocationMarker && userLocation) {
        map.setCenter(userLocationMarker.getPosition());
        map.setLevel(window.innerWidth < 768 ? 7 : 6);
        restoreButton(true);
        return;
    }
    
    // 새로 위치 가져오기
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                addUserLocationMarker(lat, lng);
                map.setCenter(new kakao.maps.LatLng(lat, lng));
                map.setLevel(window.innerWidth < 768 ? 7 : 6);
                
                restoreButton(true);
            },
            (error) => {
                console.error('위치 정보 가져오기 실패:', error);
                alert('위치 정보를 가져올 수 없습니다.');
                restoreButton(false);
            },
            {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    } else {
        alert('이 브라우저에서는 위치 서비스를 지원하지 않습니다.');
        restoreButton(false);
    }
}

// ✅ 클러스터링 토글
function toggleClustering() {
    const button = document.getElementById('clusterToggle');
    if (!button || !clusterer || !markers) return;
    
    if (isClusteringEnabled) {
        clusterer.clear();
        markers.forEach(marker => marker.setMap(map));
        button.innerHTML = window.innerWidth < 768 ? 
            '<span class="sm:hidden">개별표시</span><span class="hidden sm:inline">클러스터링 OFF</span>' :
            '클러스터링 OFF';
        button.classList.remove('bg-gray-600', 'hover:bg-gray-700');
        button.classList.add('bg-red-600', 'hover:bg-red-700');
        isClusteringEnabled = false;
    } else {
        markers.forEach(marker => marker.setMap(null));
        clusterer.addMarkers(markers);
        button.innerHTML = window.innerWidth < 768 ? 
            '<span class="sm:hidden">클러스터</span><span class="hidden sm:inline">클러스터링 ON</span>' :
            '클러스터링 ON';
        button.classList.remove('bg-red-600', 'hover:bg-red-700');
        button.classList.add('bg-gray-600', 'hover:bg-gray-700');
        isClusteringEnabled = true;
    }
}

// ✅ 거리 계산
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 지구 반지름 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// ✅ 주변 카페 표시
function showNearbyCafes(userLat, userLng) {
    if (!window.cafesData || window.cafesData.length === 0) return;
    
    const nearbyCafes = window.cafesData
        .map(cafe => {
            if (!cafe.latitude || !cafe.longitude) return null;
            const distance = calculateDistance(userLat, userLng, cafe.latitude, cafe.longitude);
            return { ...cafe, distance };
        })
        .filter(cafe => cafe && cafe.distance <= 10) // 10km 이내
        .sort((a, b) => a.distance - b.distance);

    if (nearbyCafes.length > 0) {
        displayNearbyCafes(nearbyCafes);
    }
}

// ✅ 주변 카페 목록 표시
function displayNearbyCafes(nearbyCafes) {
    const panel = document.getElementById('nearbyPanel');
    const list = document.getElementById('nearbyList');
    
    if (!panel || !list) return;
    
    list.innerHTML = '';
    
    const maxDisplay = window.innerWidth < 768 ? 3 : 5;
    nearbyCafes.slice(0, maxDisplay).forEach(cafe => {
        const item = document.createElement('div');
        item.className = 'p-2 sm:p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors';
        item.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex-1 min-w-0">
                    <h4 class="font-medium text-xs sm:text-sm text-gray-900 truncate">${cafe.cafe_name || cafe.name}</h4>
                    <p class="text-xs text-gray-600 truncate">${cafe.artist_display_name || cafe.artist}${cafe.member_name ? ' - ' + cafe.member_name : ''}</p>
                    <p class="text-xs text-blue-600">${cafe.distance.toFixed(1)}km</p>
                </div>
                <span class="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0">운영중</span>
            </div>
        `;
        
        item.addEventListener('click', () => {
            const position = new kakao.maps.LatLng(cafe.latitude, cafe.longitude);
            map.setCenter(position);
            map.setLevel(3);
            showCafeModal(cafe);
        });
        
        list.appendChild(item);
    });
    
    panel.classList.remove('hidden');
}

// ✅ 카페 모달 표시
function showCafeModal(cafe) {
    const modal = document.getElementById('cafeModal');
    const title = document.getElementById('cafeModalTitle');
    const content = document.getElementById('cafeModalContent');
    
    if (!modal || !title || !content) {
        console.warn('카페 모달 요소를 찾을 수 없습니다');
        return;
    }
    
    title.textContent = cafe.cafe_name || cafe.name || '생일카페';
    content.innerHTML = `
        <div class="space-y-3">
            <div>
                <p class="text-sm text-gray-600">아티스트: ${cafe.artist_display_name || cafe.artist || '정보 없음'}</p>
                ${cafe.member_name ? `<p class="text-sm text-gray-600">멤버: ${cafe.member_name}</p>` : ''}
            </div>
            <div>
                <p class="text-sm text-gray-600">주소: ${cafe.address || '정보 없음'}</p>
            </div>
            <div>
                <p class="text-sm text-gray-600">운영기간: ${cafe.start_date || ''} ~ ${cafe.end_date || ''}</p>
            </div>
            ${cafe.id ? `
                <div class="mt-4">
                    <a href="/ddoksang/detail/${cafe.id}/" class="w-full bg-gray-900 text-white py-2 px-4 rounded-lg text-center block hover:bg-gray-800 transition-colors">
                        자세히 보기
                    </a>
                </div>
            ` : ''}
        </div>
    `;
    
    modal.classList.remove('hidden');
}

// ✅ 카페 모달 닫기
function closeCafeModal() {
    const modal = document.getElementById('cafeModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// ✅ 지도 로딩 숨기기
function hideMapLoading() {
    const loadingEl = document.getElementById('mapLoading');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

// ✅ 지도 에러 표시
function showMapError(message) {
    const loadingEl = document.getElementById('mapLoading');
    if (loadingEl) {
        loadingEl.innerHTML = `
            <div class="text-center">
                <div class="text-red-500 text-2xl mb-2">⚠️</div>
                <p class="text-red-600 text-sm sm:text-base">${message}</p>
                <button onclick="location.reload()" class="mt-3 px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">
                    새로고침
                </button>
            </div>
        `;
    }
}

// ✅ 카페 개수 업데이트
function updateCafeCount(count) {
    const countDisplay = document.getElementById('cafeCountDisplay');
    if (countDisplay) {
        countDisplay.textContent = `${count}개 운영중`;
    }
}

// ✅ 위치로 이동 (모달에서 사용)
function moveToLocation(lat, lng) {
    if (!map) return;
    
    const position = new kakao.maps.LatLng(lat, lng);
    map.setCenter(position);
    map.setLevel(3);
    closeCafeModal();
}
// ✅ 전역 등록
window.initMap = initMap;
window.createMarkers = createMarkers;
window.addUserLocationMarker = addUserLocationMarker;
window.moveToMyLocation = moveToMyLocation;
window.toggleClustering = toggleClustering;
window.showCafeModal = showCafeModal;
window.closeCafeModal = closeCafeModal;
window.moveToLocation = moveToLocation;

console.log('maps.js 로드 완료 - 모든 기능 활성화됨');
