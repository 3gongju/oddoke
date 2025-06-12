(function(window) {
  'use strict';

  const Utils = {
    /**
     * 두 지점 간의 거리를 계산합니다 (미터 단위)
     */
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

    /**
     * 위도와 경도가 유효한지 검증합니다
     */
    isValidLatLng(lat, lng) {
      return !isNaN(lat) && !isNaN(lng) && 
             lat >= -90 && lat <= 90 && 
             lng >= -180 && lng <= 180;
    },

    /**
     * 문자열을 Base64로 인코딩합니다 (유니코드 지원)
     */
    encodeToBase64Unicode(str) {
      try {
        return btoa(unescape(encodeURIComponent(str)));
      } catch (e) {
        console.warn('Base64 인코딩 실패:', e);
        return btoa('fallback');
      }
    },

    /**
     * 기본 SVG 마커를 생성합니다
     */
    createDefaultMarker() {
      const svgString = `
        <svg xmlns='http://www.w3.org/2000/svg' width='32' height='40' viewBox='0 0 32 40'>
          <path d='M16 0C7.163 0 0 7.163 0 16s16 24 16 24 16-15.163 16-24S24.837 0 16 0z' fill='#ef4444'/>
          <circle cx='16' cy='16' r='8' fill='white'/>
          <text x='16' y='20' text-anchor='middle' font-family='Arial' font-size='12' font-weight='bold' fill='#ef4444'>🎂</text>
        </svg>`;
      const imageSrc = 'data:image/svg+xml;base64,' + Utils.encodeToBase64Unicode(svgString);
      return new kakao.maps.MarkerImage(
        imageSrc, 
        new kakao.maps.Size(32, 40), 
        { offset: new kakao.maps.Point(16, 40) }
      );
    },

    /**
     * 원형 이미지 마커를 생성합니다 (빨간 테두리 포함)
     */
    async createCircleImageMarker(cafe) {
      const imageUrl = cafe.main_image || cafe.image_url;
      if (!imageUrl) return Utils.createDefaultMarker();

      const size = 60; // canvas 크기
      const outerRadius = 26; // 외부 원 반지름 (배경)
      const innerRadius = 20; // 내부 원 반지름 (이미지)
      const borderWidth = outerRadius - innerRadius; // 테두리 두께 = 6px

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;

      return new Promise((resolve) => {
        img.onload = () => {
          try {
            ctx.clearRect(0, 0, size, size);

            const centerX = size / 2;
            const centerY = size / 2;

            // 1. 빨간 배경 원 (테두리 역할)
            ctx.beginPath();
            ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fillStyle = '#FF0000'; // 빨간색 테두리
            ctx.fill();

            // 2. 이미지를 위한 클리핑 영역 설정
            ctx.save(); // 현재 상태 저장
            ctx.beginPath();
            ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            // 3. 이미지 그리기 (정사각형 크롭)
            const minLength = Math.min(img.width, img.height);
            const sx = (img.width - minLength) / 2;
            const sy = (img.height - minLength) / 2;
            
            const imageSize = innerRadius * 2;
            const imageX = centerX - innerRadius;
            const imageY = centerY - innerRadius;
            
            ctx.drawImage(img, sx, sy, minLength, minLength, imageX, imageY, imageSize, imageSize);

            ctx.restore(); // 클리핑 해제

            // 4. 선택사항: 내부 테두리 추가 (더 깔끔한 효과)
            ctx.beginPath();
            ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.strokeStyle = '#FFFFFF'; // 흰색 내부 테두리
            ctx.lineWidth = 1;
            ctx.stroke();

            const dataUrl = canvas.toDataURL('image/png');
            const markerImage = new kakao.maps.MarkerImage(
              dataUrl,
              new kakao.maps.Size(size, size),
              { offset: new kakao.maps.Point(size / 2, size) }
            );
            resolve(markerImage);
          } catch (error) {
            console.error('Canvas 처리 중 오류:', error);
            resolve(Utils.createDefaultMarker());
          }
        };

        img.onerror = (error) => {
          console.warn('이미지 로드 실패:', imageUrl, error);
          resolve(Utils.createDefaultMarker());
        };

        // 타임아웃 설정 (5초)
        setTimeout(() => {
          console.warn('이미지 로드 타임아웃:', imageUrl);
          resolve(Utils.createDefaultMarker());
        }, 5000);
      });
    },

    /**
     * 거리를 사람이 읽기 쉬운 형태로 포맷팅합니다
     */
    formatDistance(meters) {
      if (meters < 1000) {
        return `${meters}m`;
      } else if (meters < 10000) {
        return `${(meters / 1000).toFixed(1)}km`;
      } else {
        return `${Math.round(meters / 1000)}km`;
      }
    },

    /**
     * 카페 상태를 계산합니다
     */
    getCafeStatus(startDate, endDate) {
      const today = new Date();
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // 시간 부분 제거 (날짜만 비교)
      today.setHours(0, 0, 0, 0);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      if (today < start) {
        return 'upcoming'; // 예정
      } else if (today >= start && today <= end) {
        return 'ongoing'; // 진행중
      } else {
        return 'ended'; // 종료
      }
    },

    /**
     * 카페 상태에 따른 배지 정보를 반환합니다
     */
    getStatusBadge(status) {
      const badges = {
        ongoing: { text: '진행중', class: 'bg-green-500', color: '#10b981' },
        upcoming: { text: '예정', class: 'bg-blue-500', color: '#3b82f6' },
        ended: { text: '종료', class: 'bg-gray-500', color: '#6b7280' }
      };
      return badges[status] || badges.ended;
    },

    /**
     * 디바운스 함수 (검색 최적화용)
     */
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    /**
     * 로컬 스토리지 안전 접근
     */
    safeLocalStorage: {
      get(key, defaultValue = null) {
        try {
          const item = localStorage.getItem(key);
          return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
          console.warn('localStorage 읽기 실패:', key, e);
          return defaultValue;
        }
      },

      set(key, value) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (e) {
          console.warn('localStorage 쓰기 실패:', key, e);
          return false;
        }
      },

      remove(key) {
        try {
          localStorage.removeItem(key);
          return true;
        } catch (e) {
          console.warn('localStorage 삭제 실패:', key, e);
          return false;
        }
      }
    },

    /**
     * 날짜를 한국어 형태로 포맷팅합니다
     */
    formatDate(dateString, options = {}) {
      try {
        const date = new Date(dateString);
        const defaultOptions = {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          ...options
        };
        return date.toLocaleDateString('ko-KR', defaultOptions);
      } catch (e) {
        console.warn('날짜 포맷팅 실패:', dateString, e);
        return dateString;
      }
    },

    /**
     * URL 파라미터를 객체로 파싱합니다
     */
    parseUrlParams(url = window.location.search) {
      const params = new URLSearchParams(url);
      const result = {};
      for (const [key, value] of params) {
        result[key] = value;
      }
      return result;
    },

    /**
     * 객체를 URL 파라미터 문자열로 변환합니다
     */
    objectToUrlParams(obj) {
      const params = new URLSearchParams();
      Object.entries(obj).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          params.append(key, value);
        }
      });
      return params.toString();
    }
  };

  // 전역 네임스페이스에 등록
  window.Utils = Utils;

  // AMD/CommonJS 호환성 (선택사항)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
  }

})(window);