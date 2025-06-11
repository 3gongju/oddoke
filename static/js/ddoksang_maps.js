// 지도 관리 + 공통 유틸리티 (토스트 제거, 중복 정리)

(function(window) {
  'use strict';

  // 공통 유틸리티 클래스 (모든 파일에서 사용)
  const Utils = {
    // 거리 계산
    calculateDistance(lat1, lng1, lat2, lng2) {
      const R = 6371000;
      const rad = Math.PI / 180;
      const dLat = (lat2 - lat1) * rad;
      const dLng = (lng2 - lng1) * rad;
      const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
                Math.sin(dLng / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c);
    },

    // 좌표 유효성 검사
    isValidLatLng(lat, lng) {
      return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    },

    // 카페 운영 상태 확인
    isCafeOperating(cafe) {
      const today = new Date();
      const start = new Date(cafe.start_date);
      const end = new Date(cafe.end_date);
      end.setHours(23, 59, 59, 999);
      return today >= start && today <= end;
    },

    // Base64 인코딩
    encodeToBase64Unicode(str) {
      try {
        return btoa(unescape(encodeURIComponent(str)));
      } catch (e) {
        console.warn('⚠️ base64 인코딩 실패:', str);
        return btoa('fallback');
      }
    },

    // 주변 카페 찾기
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
          walkTime: Math.round(dist / 80)
        };
      }).sort((a, b) => a.distance - b.distance);
    },

    // 커스텀 마커 이미지 생성
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

  // ✅ 지도 관리 클래스 (간소화)
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
        this.initClusterer();
        
        console.log('✅ 지도 초기화 완료');
        return true;
      } catch (e) {
        console.error('❌ 지도 초기화 실패:', e);
        return false;
      }
    }

    initClusterer() {
      this.clusterer = new kakao.maps.MarkerClusterer({
        map: this.map,
        averageCenter: true,
        minLevel: 6,
        disableClickZoom: true,
        styles: [
          {
            width: '40px', height: '40px', background: 'rgba(59, 130, 246, 0.8)',
            borderRadius: '50%', color: '#fff', textAlign: 'center',
            fontWeight: 'bold', fontSize: '14px', lineHeight: '40px'
          },
          {
            width: '50px', height: '50px', background: 'rgba(147, 51, 234, 0.8)',
            borderRadius: '50%', color: '#fff', textAlign: 'center',
            fontWeight: 'bold', fontSize: '16px', lineHeight: '50px'
          },
          {
            width: '60px', height: '60px', background: 'rgba(239, 68, 68, 0.8)',
            borderRadius: '50%', color: '#fff', textAlign: 'center',
            fontWeight: 'bold', fontSize: '18px', lineHeight: '60px'
          }
        ]
      });

      kakao.maps.event.addListener(this.clusterer, 'clusterclick', (cluster) => {
        const level = this.map.getLevel() - 2;
        this.map.setLevel(level, { anchor: cluster.getCenter() });
      });
    }

    moveToLocation(lat, lng, level = 5) {
      if (!this.map) return;
      const pos = new kakao.maps.LatLng(lat, lng);
      this.map.setCenter(pos);
      if (level) this.map.setLevel(level);
    }

    addUserLocationMarker(lat, lng) {
      if (!this.map) return;

      if (this.userLocationMarker) {
        this.userLocationMarker.setMap(null);
      }

      const position = new kakao.maps.LatLng(lat, lng);
      const imageSrc = 'data:image/svg+xml;base64,' + Utils.encodeToBase64Unicode(`
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="8" fill="#3b82f6" stroke="white" stroke-width="2"/>
          <circle cx="10" cy="10" r="3" fill="white"/>
        </svg>
      `);
      const imageSize = new kakao.maps.Size(20, 20);
      const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize);

      this.userLocationMarker = new kakao.maps.Marker({
        position, map: this.map, image: markerImage, title: '내 위치'
      });
    }

    toggleClustering() {
      if (!this.clusterer || !this.map) return false;
      
      if (this.isClusteringEnabled) {
        this.clusterer.clear();
        this.markers.forEach(marker => marker.setMap(this.map));
        this.isClusteringEnabled = false;
      } else {
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
      
      this.clearMarkers();
      const markerImage = Utils.createCafeMarkerImage();
      let successCount = 0;
      
      this.markers = cafes.map((cafe, index) => {
        try {
          const lat = parseFloat(cafe.latitude || cafe.lat);
          const lng = parseFloat(cafe.longitude || cafe.lng);
          
          if (!Utils.isValidLatLng(lat, lng)) {
            console.warn(`⚠️ 카페 ${index}: 잘못된 좌표 (${lat}, ${lng})`);
            return null;
          }

          const position = new kakao.maps.LatLng(lat, lng);
          const marker = new kakao.maps.Marker({
            position,
            image: markerImage,
            title: cafe.name || cafe.cafe_name || `생일카페 ${index + 1}`
          });

          if (onMarkerClick && typeof onMarkerClick === 'function') {
            kakao.maps.event.addListener(marker, 'click', () => {
              console.log('🎯 마커 클릭:', cafe.name || cafe.cafe_name);
              onMarkerClick(cafe);
            });
          }

          successCount++;
          return marker;
        } catch (error) {
          console.error(`❌ 카페 ${index} 마커 생성 실패:`, error);
          return null;
        }
      }).filter(Boolean);

      console.log(`✅ 마커 생성 완료: ${successCount}/${cafes.length}개`);

      if (this.isClusteringEnabled) {
        this.clusterer.addMarkers(this.markers);
      } else {
        this.markers.forEach(marker => marker.setMap(this.map));
      }

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

  // ✅ 주변 카페 리스트 표시 (간소화)
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

    if (onCafeClick && typeof onCafeClick === 'function') {
      container.querySelectorAll('.nearby-cafe-item').forEach(item => {
        item.addEventListener('click', () => {
          const cafeId = item.dataset.cafeId;
          const cafe = cafes.find(c => c.id == cafeId);
          if (cafe) onCafeClick(cafe);
        });
      });
    }
  }

  // 전역 노출
  window.DdoksangMap = {
    MapManager,
    Utils,
    displayNearbyCafes
  };

})(window);