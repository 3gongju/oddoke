// style-customization-examples.js - 스타일 커스터마이징 예시

/**
 * 중복 확인 카드 스타일 커스터마이징 예시
 * 
 * duplicate-card-template.js가 로드된 후에 실행하세요.
 */

// 사용 예시들:

// 1. 카드 색상을 빨간색에서 주황색으로 변경
function changeToOrangeTheme() {
    window.DuplicateCardTemplate.updateStyles({
        card: {
            container: "bg-white border-2 border-orange-200 rounded-xl p-4 hover:border-orange-300 transition-colors shadow-sm hover:shadow-md"
        },
        icons: {
            warning: "w-6 h-6 text-orange-500"
        }
    });
    
}

// 2. 더 부드러운 스타일로 변경
function changeToPastelTheme() {
    window.DuplicateCardTemplate.updateStyles({
        card: {
            container: "bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 rounded-2xl p-6 hover:border-pink-300 transition-all duration-300 shadow-lg hover:shadow-xl"
        },
        badges: {
            artist: "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700",
            member: "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-700"
        },
        text: {
            title: "font-bold text-xl text-purple-900"
        }
    });
    
}

// 3. 미니멀한 스타일로 변경
function changeToMinimalTheme() {
    window.DuplicateCardTemplate.updateStyles({
        card: {
            container: "bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
        },
        badges: {
            artist: "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700",
            member: "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
        },
        icons: {
            warning: "w-5 h-5 text-gray-400"
        }
    });
    
}



// 5. 실시간 스타일 변경 함수
function applyCustomTheme(themeName) {
    const themes = {
        default: {}, // 기본 스타일 유지
        orange: changeToOrangeTheme,
        pastel: changeToPastelTheme, 
        minimal: changeToMinimalTheme,
        dark: changeToDarkTheme
    };
    
    if (themes[themeName]) {
        if (typeof themes[themeName] === 'function') {
            themes[themeName]();
        }
        
        // 현재 표시된 카드가 있다면 다시 렌더링
        if (window.DuplicateChecker && window.DuplicateChecker.state.currentResults.length > 0) {
            window.DuplicateChecker.showDuplicateCafes(window.DuplicateChecker.state.currentResults);
        }
    } else {
        console.warn(`알 수 없는 테마: ${themeName}`);
    }
}

// 6. HTML에서 직접 사용할 수 있는 테마 선택기
function createThemeSelector() {
    const selector = document.createElement('div');
    selector.innerHTML = `
        <div class="fixed bottom-4 right-4 bg-white p-3 rounded-lg shadow-lg border z-50" style="display: none;" id="theme-selector">
            <h4 class="text-sm font-medium mb-2">카드 테마 선택</h4>
            <div class="space-y-1">
                <button onclick="applyCustomTheme('default')" class="block w-full text-left px-2 py-1 text-xs hover:bg-gray-100 rounded">기본</button>
                <button onclick="applyCustomTheme('orange')" class="block w-full text-left px-2 py-1 text-xs hover:bg-gray-100 rounded">주황색</button>
                <button onclick="applyCustomTheme('pastel')" class="block w-full text-left px-2 py-1 text-xs hover:bg-gray-100 rounded">파스텔</button>
                <button onclick="applyCustomTheme('minimal')" class="block w-full text-left px-2 py-1 text-xs hover:bg-gray-100 rounded">미니멀</button>
            </div>
            <button onclick="document.getElementById('theme-selector').style.display='none'" class="mt-2 text-xs text-gray-500">닫기</button>
        </div>
    `;
    
    document.body.appendChild(selector);
    
    // 테마 선택기 토글 버튼도 추가
    const toggleButton = document.createElement('button');
    toggleButton.innerHTML = '🎨';
    toggleButton.className = 'fixed bottom-4 right-4 w-12 h-12 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors z-40';
    toggleButton.onclick = () => {
        const themeSelector = document.getElementById('theme-selector');
        themeSelector.style.display = themeSelector.style.display === 'none' ? 'block' : 'none';
    };
    
    document.body.appendChild(toggleButton);
}


// 전역 함수로 노출
window.applyCustomTheme = applyCustomTheme;
window.createThemeSelector = createThemeSelector;


/**
 *  사용 방법:
 * 
 * 1. 콘솔에서 직접 실행:
 *    applyCustomTheme('orange')
 * 
 * 2. HTML에서 버튼으로:
 *    <button onclick="applyCustomTheme('pastel')">파스텔 테마</button>
 * 
 * 3. 개발 환경에서 오른쪽 하단 🎨 버튼 클릭
 * 
 * 4. 직접 스타일 수정:
 *    window.DuplicateCardTemplate.updateStyles({
 *      card: { container: "your-custom-classes" }
 *    })
 */