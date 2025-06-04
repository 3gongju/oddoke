// static/js/map.js
// 전역 변수
let map;
let clusterer;
let markers = [];
let userLocationMarker = null;
let isClusteringEnabled = true;
let userLocation = null;

// 지도 초기화 (모바일 대응)
function initMap(centerLat = 37.5665, centerLng = 126.9780) {
    try {
        // 카카오맵 API 로드 확인
        if (typeof kakao === 'undefined' || typeof kakao.maps === 'undefined') {
            console.error('카카오맵 API가 로드되지 않았습니다.');
            document.getElementById('mapLoading').innerHTML = `
                <div class="text-center">
                    <p class="text-red-600 text-sm sm:text-base">지도를 불러올 수 없습니다.</p>
                    <p class="text-gray-500 text-xs mt-2">카카오맵 API 키를 확인해주세요.</p>
                </div>
            `;
            return;
        }

        const mapContainer = document.getElementById('mapContainer');
        if (!mapContainer) {
            console.error('지도 컨테이너를 찾을 수 없습니다.');
            return;
        }

        const mapOption = {
            center: new kakao.maps.LatLng(centerLat, centerLng),
            level: window.innerWidth < 768 ? 9 : 8
        };

        // 지도 생성
        map = new kakao.maps.Map(mapContainer, mapOption);

        // 클러스터러 생성
        if (typeof kakao.maps.MarkerClusterer !== 'undefined') {
            clusterer = new kakao.maps.MarkerClusterer({
                map: map,
                averageCenter: true,
                minLevel: window.innerWidth < 768 ? 7 : 6,
                disableClickZoom: true,
                styles: [
                    {
                        width: window.innerWidth < 768 ? '32px' : '40px',
                        height: window.innerWidth < 768 ? '32px' : '40px',
                        background: 'rgba(59, 130, 246, 0.8)',
                        borderRadius: '50%',
                        color: '#fff',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontSize: window.innerWidth < 768 ? '12px' : '14px',
                        lineHeight: window.innerWidth < 768 ? '32px' : '40px'
                    },
                    {
                        width: window.innerWidth < 768 ? '40px' : '50px',
                        height: window.innerWidth < 768 ? '40px' : '50px',
                        background: 'rgba(147, 51, 234, 0.8)',
                        borderRadius: '50%',
                        color: '#fff',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontSize: window.innerWidth < 768 ? '14px' : '16px',
                        lineHeight: window.innerWidth < 768 ? '40px' : '50px'
                    },
                    {
                        width: window.innerWidth < 768 ? '48px' : '60px',
                        height: window.innerWidth < 768 ? '48px' : '60px',
                        background: 'rgba(239, 68, 68, 0.8)',
                        borderRadius: '50%',
                        color: '#fff',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontSize: window.innerWidth < 768 ? '16px' : '18px',
                        lineHeight: window.innerWidth < 768 ? '48px' : '60px'
                    }
                ]
            });
        }

        // 지도 로딩 완료 후 처리
        setTimeout(() => {
            document.getElementById('mapLoading').style.display = 'none';
            createMarkers();
            map.relayout();
        }, 500);

    } catch (error) {
        console.error('지도 초기화 중 오류 발생:', error);
        document.getElementById('mapLoading').innerHTML = `
            <div class="text-center">
                <p class="text-red-600 text-sm sm:text-base">지도 초기화 실패</p>
                <p class="text-gray-500 text-xs mt-2">${error.message}</p>
                <button onclick="location.reload()" class="mt-3 px-4 py-2 bg-gray-600 text-white rounded text-sm">
                    새로고침
                </button>
            </div>
        `;
    }
}

// 마커 생성
function createMarkers() {
    try {
        markers = [];
        
        if (!window.cafesData || window.cafesData.length === 0) {
            console.log('생일카페 데이터가 없습니다.');
            return;
        }

        window.cafesData.forEach((cafe, index) => {
            if (!cafe.latitude || !cafe.longitude) {
                console.warn(`카페 ${cafe.name}: 좌표 정보 없음`, cafe);
                return;
            }

            const position = new kakao.maps.LatLng(parseFloat(cafe.latitude), parseFloat(cafe.longitude));
            const marker = new kakao.maps.Marker({
                position: position,
                title: cafe.name || '생일카페'
            });

            kakao.maps.event.addListener(marker, 'click', () => {
                showCafeModal(cafe);
            });

            markers.push(marker);
        });

        displayMarkers();
        
    } catch (error) {
        console.error('마커 생성 중 오류:', error);
    }
}

// 마커 표시
function displayMarkers() {
    if (markers.length === 0) return;
    
    if (isClusteringEnabled && clusterer) {
        clusterer.addMarkers(markers);
    } else {
        markers.forEach(marker => marker.setMap(map));
    }
}

// 사용자 위치 마커 추가
function addUserLocationMarker(lat, lng) {
    const position = new kakao.maps.LatLng(lat, lng);
    const markerSize = window.innerWidth < 768 ? 16 : 20;
    const imageSrc = 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${markerSize}" height="${markerSize}" viewBox="0 0 ${markerSize} ${markerSize}">
            <circle cx="${markerSize/2}" cy="${markerSize/2}" r="${markerSize*0.4}" fill="#3b82f6" stroke="white" stroke-width="2"/>
            <circle cx="${markerSize/2}" cy="${markerSize/2}" r="${markerSize*0.15}" fill="white"/>
        </svg>
    `);

    const imageSize = new kakao.maps.Size(markerSize, markerSize);
    const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize);

    userLocationMarker = new kakao.maps.Marker({
        map: map,
        position: position,
        image: markerImage,
        title: "내 위치"
    });
}

// 사용자 위치 가져오기
function getUserLocation() {
    if (navigator.geolocation) {
        document.getElementById('mapLoading').style.display = 'flex';
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                userLocation = { lat, lng };
                
                initMap(lat, lng);
                addUserLocationMarker(lat, lng);
                showNearbyCafes(lat, lng);
            },
            (error) => {
                console.error('위치 정보 가져오기 실패:', error);
                alert('위치 정보를 가져올 수 없습니다. 기본 지도를 표시합니다.');
                initMap();
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    } else {
        alert('이 브라우저에서는 위치 서비스를 지원하지 않습니다.');
        initMap();
    }
}

// 내 위치로 이동
function moveToMyLocation() {
    const btn = document.getElementById('myLocationBtn');
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
    
    if (userLocationMarker) {
        map.setCenter(userLocationMarker.getPosition());
        map.setLevel(window.innerWidth < 768 ? 7 : 6);
        restoreButton(true);
    } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                userLocation = { lat, lng };
                
                addUserLocationMarker(lat, lng);
                map.setCenter(new kakao.maps.LatLng(lat, lng));
                map.setLevel(window.innerWidth < 768 ? 7 : 6);
                showNearbyCafes(lat, lng);
                restoreButton(true);
            },
            (error) => {
                console.error('위치 정보 가져오기 실패:', error);
                alert('위치 정보를 가져올 수 없습니다.');
                restoreButton(false);
            }
        );
    }
}

// 클러스터링 토글
function toggleClustering() {
    const button = document.getElementById('clusterToggle');
    
    if (isClusteringEnabled) {
        if (clusterer) clusterer.clear();
        markers.forEach(marker => marker.setMap(map));
        
        button.innerHTML = window.innerWidth < 768 ? 
            '<span class="sm:hidden">개별표시</span><span class="hidden sm:inline">클러스터링 OFF</span>' :
            '클러스터링 OFF';
        button.classList.remove('bg-gray-600', 'hover:bg-gray-700');
        button.classList.add('bg-red-600', 'hover:bg-red-700');
        isClusteringEnabled = false;
    } else {
        markers.forEach(marker => marker.setMap(null));
        if (clusterer) clusterer.addMarkers(markers);
        
        button.innerHTML = window.innerWidth < 768 ? 
            '<span class="sm:hidden">클러스터</span><span class="hidden sm:inline">클러스터링 ON</span>' :
            '클러스터링 ON';
        button.classList.remove('bg-red-600', 'hover:bg-red-700');
        button.classList.add('bg-gray-600', 'hover:bg-gray-700');
        isClusteringEnabled = true;
    }
}

// 거리 계산
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// 주변 카페 표시
function showNearbyCafes(userLat, userLng) {
    const nearbyCafes = window.cafesData.map(cafe => {
        const distance = calculateDistance(userLat, userLng, cafe.latitude, cafe.longitude);
        return { ...cafe, distance };
    }).filter(cafe => cafe.distance <= 10)
      .sort((a, b) => a.distance - b.distance);

    if (nearbyCafes.length > 0) {
        displayNearbyCafes(nearbyCafes);
    }
}

// 주변 카페 목록 표시
function displayNearbyCafes(nearbyCafes) {
    const panel = document.getElementById('nearbyPanel');
    const list = document.getElementById('nearbyList');
    
    list.innerHTML = '';
    
    const maxDisplay = window.innerWidth < 768 ? 3 : 5;
    nearbyCafes.slice(0, maxDisplay).forEach(cafe => {
        const item = document.createElement('div');
        item.className = 'p-2 sm:p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors';
        item.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex-1 min-w-0">
                    <h4 class="font-medium text-xs sm:text-sm text-gray-900 truncate">${cafe.name}</h4>
                    <p class="text-xs text-gray-600 truncate">${cafe.artist}${cafe.member ? ' - ' + cafe.member : ''}</p>
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

// 위치로 이동
function moveToLocation(lat, lng) {
    const position = new kakao.maps.LatLng(lat, lng);
    map.setCenter(position);
    map.setLevel(3);
    closeCafeModal();
}

// 전역 함수로 설정
window.moveToLocation = moveToLocation;