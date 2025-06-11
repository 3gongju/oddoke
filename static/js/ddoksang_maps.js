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
      return !isNaN(lat) && !isNaN(lng);
    },
    isCafeOperating(cafe) {
      const today = new Date();
      const start = new Date(cafe.start_date);
      const end = new Date(cafe.end_date);
      return today >= start && today <= end;
    },
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

    findNearbyCafes(lat, lng, cafes, radiusKm = 3) {
      return cafes.filter(cafe => {
        const dist = Utils.calculateDistance(
          lat, lng,
          parseFloat(cafe.latitude), parseFloat(cafe.longitude)
        );
        return dist <= radiusKm * 1000;
      }).map(cafe => {
        const dist = Utils.calculateDistance(
          lat, lng,
          parseFloat(cafe.latitude), parseFloat(cafe.longitude)
        );
        return {
          ...cafe,
          distance: dist,
          walkTime: Math.round(dist / 80)
        };
      }).sort((a, b) => a.distance - b.distance);
    }
  };

  class MapManager {
    constructor(containerId) {
      this.containerId = containerId;
      this.map = null;
      this.clusterer = null;
    }

    async init(center = { lat: 37.5665, lng: 126.9780 }, level = 6) {
      try {
        const container = document.getElementById(this.containerId);
        if (!container) throw new Error('지도 컨테이너가 존재하지 않습니다.');
        const options = {
          center: new kakao.maps.LatLng(center.lat, center.lng),
          level
        };
        this.map = new kakao.maps.Map(container, options);
        this.clusterer = new kakao.maps.MarkerClusterer({
          map: this.map,
          averageCenter: true,
          minLevel: 8
        });
        return true;
      } catch (e) {
        console.error('지도 초기화 실패:', e);
        return false;
      }
    }

    moveToLocation(lat, lng, level = 5) {
      if (!this.map) return;
      const pos = new kakao.maps.LatLng(lat, lng);
      this.map.setCenter(pos);
      this.map.setLevel(level);
    }

    addUserLocationMarker(lat, lng) {
      if (!this.map) return;
      const position = new kakao.maps.LatLng(lat, lng);
      const marker = new kakao.maps.Marker({
        position,
        map: this.map
      });
    }

    toggleClustering() {
      if (!this.clusterer || !this.map) return false;
      const isVisible = this.clusterer.getMarkers().length > 0;
      this.clusterer.clear();
      return !isVisible;
    }

    loadCafes(cafes, onClick) {
      if (!this.map || !this.clusterer) return;
      const markers = cafes.map((cafe, i) => {
        try {
          const lat = parseFloat(cafe.latitude);
          const lng = parseFloat(cafe.longitude);
          if (!Utils.isValidLatLng(lat, lng)) return null;
          const marker = new kakao.maps.Marker({
            position: new kakao.maps.LatLng(lat, lng),
            title: cafe.name || cafe.cafe_name || `카페 ${i + 1}`,
            map: this.map
          });
          kakao.maps.event.addListener(marker, 'click', () => onClick?.(cafe));
          return marker;
        } catch (e) {
          console.warn(`마커 생성 실패: ${e}`, cafe);
          return null;
        }
      }).filter(Boolean);
      this.clusterer.clear();
      this.clusterer.addMarkers(markers);
    }
  }

  function showToast(message, type = 'info') {
    alert(`${type.toUpperCase()}: ${message}`); // 임시 처리. 추후 토스트로 대체
  }

  window.DdoksangMap = {
    MapManager,
    Utils,
    showToast
  };
})(window);
