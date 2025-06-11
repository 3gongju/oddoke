(function(window) {
  'use strict';

  const Utils = {
    encodeToBase64Unicode(str) {
      try {
        return btoa(unescape(encodeURIComponent(str)));
      } catch (e) {
        console.warn('⚠️ base64 인코딩 실패:', str);
        return btoa('fallback');
      }
    },
    isValidLatLng(lat, lng) {
      return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    },
    isCafeOperating(cafe) {
      const today = new Date();
      const start = new Date(cafe.start_date);
      const end = new Date(cafe.end_date);
      end.setHours(23, 59, 59, 999); // 종료일 마지막 시간까지 포함
      return today >= start && today <= end;
    },
    calculateDistance(lat1, lng1, lat2, lng2) {
      const R = 6371000; // 지구 반지름 (미터)
      const rad = Math.PI / 180;
      const dLat = (lat2 - lat1) * rad;
      const dLng = (lng2 - lng1) * rad;
      const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
                Math.sin(dLng / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c);
    },

    findNearbyCafes(lat, lng, cafes, radiusKm = 3) {
      return cafes.filter(cafe => {
        const cafeLat = parseFloat(cafe.latitude || cafe.lat);
        const cafeLng = parseFloat(cafe.longitude || cafe.lng);
        if (!Utils.isValidLatLng(cafeLat, cafeLng)) return false;
        
        const dist = Utils.calculateDistance(lat, lng, cafeLat, cafeLng);
        return dist <= radiusKm * 1000;
      }).map(cafe => {
        const cafeLat = parseFloat(cafe.latitude || cafe.lat);
        const cafeLng = parseFloat(cafe.longitude || cafe.lng);
        const dist = Utils.calculateDistance(lat, lng, cafeLat, cafeLng);
        return {
          ...cafe,
          distance: dist,
          walkTime: Math.round(dist / 80) // 평균 도보 속도 80m/분
        };
      }).sort((a, b) => a.distance - b.distance);
    },

    // ✅ 커스텀 마커 이미지 생성
    createCafeMarkerImage() {
      const svgString = `
        <svg xmlns='http://www.w3.org/2000/svg' width='32' height='40' viewBox='0 0 32 40'>
          <path d='M16 0C7.163 0 0 7.163 0 16s16 24 16 24 16-15.163 16-24S24.837 0 16 0z' fill='#ef4444'/>
          <circle cx='16' cy='16' r='8' fill='white'/>
          <text x='16' y='20' text-anchor='middle' font-family='Arial' font-size='12' font-weight='bold' fill='#ef4444'>🎂</text>
        </svg>`;
      
      const imageSrc = 'data:image/svg+xml;base64,' + Utils.encodeToBase64Unicode(svgString);
      const imageSize = new kakao.maps.Size(32, 40);
      const imageOption = { offset: new kakao.maps.Point(16, 40) };
      return new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);
    }
  };

  class MapManager {
    constructor(containerId) {
      this.containerId = containerId;
      this.map = null;
      this.clusterer = null;
      this.markers = [];
      this.userLocationMarker = null;
      this.isClusteringEnabled = true;
    }

    async init(center = { lat: 37.5665, lng: 126.9780 }, level = 6) {
      try {
        const container = document.getElementById(this.containerId);
        if (!container) throw new Error(`지도 컨테이너 '${this.containerId}'가 존재하지 않습니다.`);
        
        const options = {
          center: new kakao.maps.LatLng(center.lat, center.lng),
          level
        };
        
        this.map = new kakao.maps.Map(container, options);
        
        // 클러스터러 초기화
        this.clusterer = new kakao.maps.MarkerClusterer({
          map: this.map,
          averageCenter: true,
          minLevel: 6,
          disableClickZoom: true,
          styles: [
            {
              width: '40px',
              height: '40px',
              background: 'rgba(59, 130, 246, 0.8)',
              borderRadius: '50%',
              color: '#fff',
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: '14px',
              lineHeight: '40px'
            },
            {
              width: '50px',
              height: '50px',
              background: 'rgba(147, 51, 234, 0.8)',
              borderRadius: '50%',
              color: '#fff',
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: '16px',
              lineHeight: '50px'
            },
            {
              width: '60px',
              height: '60px',
              background: 'rgba(239, 68, 68, 0.8)',
              borderRadius: '50%',
              color: '#fff',
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: '18px',
              lineHeight: '60px'
            }
          ]
        });

        // 클러스터 클릭 이벤트
        kakao.maps.event.addListener(this.clusterer, 'clusterclick', (cluster) => {
          const level = this.map.getLevel() - 2;
          this.map.setLevel(level, { anchor: cluster.getCenter() });
        });

        console.log('✅ 지도 및 클러스터러 초기화 완료');
        return true;
      } catch (e) {
        console.error('❌ 지도 초기화 실패:', e);
        return false;
      }
    }

    moveToLocation(lat, lng, level = 5) {
      if (!this.map) return;
      const pos = new kakao.maps.LatLng(lat, lng);
      this.map.setCenter(pos);
      if (level) this.map.setLevel(level);
    }

    addUserLocationMarker(lat, lng) {
      if (!this.map) return;

      // 기존 사용자 위치 마커 제거
      if (this.userLocationMarker) {
        this.userLocationMarker.setMap(null);
      }

      const position = new kakao.maps.LatLng(lat, lng);
      
      // 사용자 위치 마커 이미지 생성
      const imageSrc = 'data:image/svg+xml;base64,' + Utils.encodeToBase64Unicode(`
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="8" fill="#3b82f6" stroke="white" stroke-width="2"/>
          <circle cx="10" cy="10" r="3" fill="white"/>
        </svg>
      `);
      const imageSize = new kakao.maps.Size(20, 20);
      const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize);

      this.userLocationMarker = new kakao.maps.Marker({
        position,
        map: this.map,
        image: markerImage,
        title: '내 위치'
      });
    }

    toggleClustering() {
      if (!this.clusterer || !this.map) return false;
      
      if (this.isClusteringEnabled) {
        // 클러스터링 비활성화
        this.clusterer.clear();
        this.markers.forEach(marker => marker.setMap(this.map));
        this.isClusteringEnabled = false;
      } else {
        // 클러스터링 활성화
        this.markers.forEach(marker => marker.setMap(null));
        this.clusterer.addMarkers(this.markers);
        this.isClusteringEnabled = true;
      }
      
      return this.isClusteringEnabled;
    }

    loadCafes(cafes, onMarkerClick) {
      if (!this.map || !this.clusterer) {
        console.error('❌ 지도나 클러스터러가 초기화되지 않았습니다.');
        return;
      }

      console.log(`🗺️ ${cafes.length}개 카페 마커 생성 시작`);
      
      // 기존 마커 정리
      this.clearMarkers();
      
      const markerImage = Utils.createCafeMarkerImage();
      let successCount = 0;
      
      this.markers = cafes.map((cafe, index) => {
        try {
          const lat = parseFloat(cafe.latitude || cafe.lat);
          const lng = parseFloat(cafe.longitude || cafe.lng);
          
          if (!Utils.isValidLatLng(lat, lng)) {
            console.warn(`⚠️ 카페 ${index}: 잘못된 좌표 (${lat}, ${lng})`, cafe);
            return null;
          }

          const position = new kakao.maps.LatLng(lat, lng);
          const marker = new kakao.maps.Marker({
            position,
            image: markerImage,
            title: cafe.name || cafe.cafe_name || `생일카페 ${index + 1}`
          });

          // ✅ 마커 클릭 이벤트 등록
          if (onMarkerClick && typeof onMarkerClick === 'function') {
            kakao.maps.event.addListener(marker, 'click', () => {
              console.log('🎯 마커 클릭 이벤트:', cafe.name || cafe.cafe_name);
              onMarkerClick(cafe);
            });
          }

          successCount++;
          return marker;
        } catch (error) {
          console.error(`❌ 카페 ${index} 마커 생성 실패:`, error, cafe);
          return null;
        }
      }).filter(Boolean);

      console.log(`✅ 마커 생성 완료: ${successCount}/${cafes.length}개`);

      // 클러스터러에 마커 추가
      if (this.isClusteringEnabled) {
        this.clusterer.addMarkers(this.markers);
      } else {
        this.markers.forEach(marker => marker.setMap(this.map));
      }

      // 첫 번째 유효한 마커 위치로 지도 중심 이동
      if (this.markers.length > 0) {
        const firstPosition = this.markers[0].getPosition();
        this.map.setCenter(firstPosition);
        this.map.setLevel(8);
      }
    }

    clearMarkers() {
      if (this.clusterer) {
        this.clusterer.clear();
      }
      if (this.markers) {
        this.markers.forEach(marker => marker.setMap(null));
      }
      this.markers = [];
    }
  }

  // ✅ 주변 카페 리스트 표시 함수
  function displayNearbyCafes(cafes, containerId, onCafeClick) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`❌ 컨테이너 '${containerId}'를 찾을 수 없습니다.`);
      return;
    }

    if (!cafes || cafes.length === 0) {
      container.innerHTML = '<div class="text-center text-gray-500 py-4">주변에 운영중인 카페가 없습니다.</div>';
      return;
    }

    const cafeItemsHTML = cafes.slice(0, 10).map(cafe => {
      const cafeName = cafe.name || cafe.cafe_name || '생일카페';
      const artistName = cafe.artist || cafe.artist_name || '';
      const memberName = cafe.member || cafe.member_name || '';
      const address = cafe.address || '주소 정보 없음';
      const mainImage = cafe.main_image || cafe.image_url;
      
      return `
        <div class="nearby-cafe-item border border-gray-200 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-all duration-200 hover:shadow-md" 
             data-cafe-id="${cafe.id}" data-cafe-lat="${cafe.latitude || cafe.lat}" data-cafe-lng="${cafe.longitude || cafe.lng}">
          <div class="flex items-start space-x-3">
            ${mainImage ? 
              `<img src="${mainImage}" alt="${cafeName}" class="w-12 h-12 object-cover rounded-lg flex-shrink-0">` :
              '<div class="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0"><span class="text-gray-400 text-sm">🎂</span></div>'
            }
            <div class="flex-1 min-w-0">
              <h4 class="font-medium text-sm text-gray-900 truncate">${cafeName}</h4>
              <p class="text-xs text-gray-600 truncate">${artistName}${memberName ? ` - ${memberName}` : ''}</p>
              <p class="text-xs text-gray-500 truncate mt-1">${address}</p>
              <div class="flex items-center space-x-2 mt-2">
                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">${cafe.distance}m</span>
                <span class="text-xs text-gray-500">도보 ${cafe.walkTime}분</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = cafeItemsHTML;

    // 클릭 이벤트 등록
    if (onCafeClick && typeof onCafeClick === 'function') {
      container.querySelectorAll('.nearby-cafe-item').forEach(item => {
        item.addEventListener('click', () => {
          const cafeId = item.dataset.cafeId;
          const cafe = cafes.find(c => c.id == cafeId);
          if (cafe) {
            onCafeClick(cafe);
          }
        });
      });
    }
  }

  function showToast(message, type = 'info') {
    // 개선된 토스트 시스템 사용
    if (window.ddoksangToast) {
      return window.ddoksangToast.show(message, type);
    }
    
    // Fallback: 기존 간단한 토스트
    const toast = document.createElement('div');
    toast.className = 'ddoksang-toast fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-white text-sm font-medium shadow-lg transition-all duration-300';
    
    const colors = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      warning: 'bg-yellow-500',
      info: 'bg-blue-500'
    };
    toast.classList.add(colors[type] || colors.info);
    
    toast.textContent = message;
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 20px)';

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translate(-50%, 0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, 20px)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  // 전역 노출
  window.DdoksangMap = {
    MapManager,
    Utils,
    showToast,
    displayNearbyCafes
  };

  console.log('✅ DdoksangMap 모듈 로드 완료 (마커 클릭 이벤트 수정)');

})(window);