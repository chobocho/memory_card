document.addEventListener('DOMContentLoaded', () => {
    // 9. 카드 이미지 자산 목록 생성
    const suits = [
        { name: 'S', start: 2, end: 14 }, // Spade (11=J, 12=Q, 13=K, 14=A)
        { name: 'D', start: 2, end: 14 }, // Diamond
        { name: 'H', start: 2, end: 14 }, // Heart
        { name: 'C', start: 2, end: 13 }  // Clover (CK까지, CA없음 요구사항 반영)
    ];

    const cardImages = [];

    suits.forEach(suit => {
        for (let i = suit.start; i <= suit.end; i++) {
            let rank = i;
            if (i === 11) rank = 'J';
            else if (i === 12) rank = 'Q';
            else if (i === 13) rank = 'K';
            else if (i === 14) rank = 'A';

            // 파일명 형식: S2.png, CK.png 등
            cardImages.push(`${suit.name}${rank}.png`);
        }
    });

    // 게임 상태 변수
    let currentLevel = 1;
    let maxLevel = 100; // 3. 100단계
    let timer = null;
    let timeLeft = 0;
    let cards = [];
    let flippedCards = [];
    let matchedPairs = 0;
    let totalPairs = 0;
    let isGameActive = false;
    let isProcessing = false; // 카드 뒤집기 애니메이션 중 클릭 방지

    // DOM 요소
    const boardEl = document.getElementById('game-board');
    const levelDisplay = document.getElementById('level-display');
    const timeDisplay = document.getElementById('timer-display');
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMsg = document.getElementById('modal-msg');
    const modalBtn = document.getElementById('modal-btn');

    // 5. 브라우저 저장소에서 레벨 불러오기
    function loadProgress() {
        const savedLevel = localStorage.getItem('memoryGameLevel');
        if (savedLevel) {
            currentLevel = parseInt(savedLevel, 10);
            if (currentLevel > maxLevel) currentLevel = 1;
        } else {
            currentLevel = 1;
        }
    }

    // 진행 상황 저장
    function saveProgress(level) {
        localStorage.setItem('memoryGameLevel', level);
    }

    // 4. 레벨별 난이도 설정 (카드 수 및 시간)
    function getLevelConfig(level) {
        // 기본 2쌍(4장)부터 시작
        // 레벨이 오를수록 쌍의 개수가 늘어남 (최대 24쌍=48장 정도로 제한)
        let pairs = Math.min(2 + Math.floor((level - 1) / 2), 24);

        // 시간: 기본시간 + (쌍 개수 * 난이도 팩터) - (레벨에 따른 감소)
        // 레벨이 높을수록 카드는 많아지지만 시간 여유는 빡빡해짐
        let baseTime = 10;
        let timePerPair = 5;
        let penalty = Math.floor(level / 5);
        let time = baseTime + (pairs * timePerPair) - penalty;

        if (time < 10) time = 10; // 최소 10초 보장

        // 그리드 컬럼 수 계산 (반응형)
        let cols = 4;
        if (pairs >= 6) cols = 4;
        if (pairs >= 8) cols = 5;
        if (pairs >= 10) cols = 6;
        if (pairs >= 15) cols = 8;

        return { pairs, time, cols };
    }

    // 게임 시작
    function startGame(level) {
        currentLevel = level;
        levelDisplay.textContent = currentLevel;
        saveProgress(currentLevel);

        const config = getLevelConfig(currentLevel);
        timeLeft = config.time;
        totalPairs = config.pairs;
        matchedPairs = 0;
        flippedCards = [];
        isProcessing = false;

        timeDisplay.textContent = timeLeft;

        setupBoard(config);
        startTimer();
        isGameActive = true;
    }

    // 보드 세팅
    function setupBoard(config) {
        boardEl.innerHTML = '';
        boardEl.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;

        // 덱 생성 (필요한 쌍만큼 랜덤 추출)
        let deck = [];
        // 전체 이미지 풀에서 랜덤하게 필요한 개수만 뽑음
        let shuffledAssets = [...cardImages].sort(() => 0.5 - Math.random());
        let selectedAssets = shuffledAssets.slice(0, config.pairs);

        // 쌍으로 만들기
        selectedAssets.forEach(asset => {
            deck.push(asset);
            deck.push(asset);
        });

        // 덱 섞기
        deck.sort(() => 0.5 - Math.random());

        // 카드 DOM 생성
        deck.forEach((imgSrc, index) => {
            const card = document.createElement('div');
            card.classList.add('card');
            card.dataset.id = index;
            card.dataset.image = imgSrc;

            card.innerHTML = `
                <div class="card-inner">
                    <div class="card-front">
                        <img src="assets/${imgSrc}" alt="card">
                    </div>
                    <div class="card-back">
                        <img src="assets/back.png" alt="back">
                    </div>
                </div>
            `;

            // 10. 마우스와 터치 지원 (Click 이벤트로 통합 처리)
            card.addEventListener('click', () => flipCard(card));
            boardEl.appendChild(card);
        });
    }

    // 카드 뒤집기 로직
    function flipCard(card) {
        if (!isGameActive || isProcessing) return;
        if (card.classList.contains('flipped') || card.classList.contains('matched')) return;

        card.classList.add('flipped');
        flippedCards.push(card);

        if (flippedCards.length === 2) {
            checkForMatch();
        }
    }

    // 매칭 검사
    function checkForMatch() {
        isProcessing = true;
        const [card1, card2] = flippedCards;

        if (card1.dataset.image === card2.dataset.image) {
            // 매칭 성공
            card1.classList.add('matched');
            card2.classList.add('matched');
            matchedPairs++;
            flippedCards = [];
            isProcessing = false;

            if (matchedPairs === totalPairs) {
                levelClear();
            }
        } else {
            // 매칭 실패
            setTimeout(() => {
                card1.classList.remove('flipped');
                card2.classList.remove('flipped');
                flippedCards = [];
                isProcessing = false;
            }, 800); // 0.8초 후 다시 뒤집힘
        }
    }

    // 타이머
    function startTimer() {
        if (timer) clearInterval(timer);
        timer = setInterval(() => {
            timeLeft--;
            timeDisplay.textContent = timeLeft;

            if (timeLeft <= 0) {
                gameOver();
            }
        }, 1000);
    }

    // 레벨 클리어
    function levelClear() {
        clearInterval(timer);
        isGameActive = false;

        if (currentLevel >= maxLevel) {
            showModal("축하합니다!", "모든 레벨을 클리어하셨습니다!", "처음으로", () => startGame(1));
        } else {
            showModal("성공!", `레벨 ${currentLevel} 클리어!`, "다음 레벨", () => {
                startGame(currentLevel + 1);
            });
        }
    }

    // 게임 오버
    function gameOver() {
        clearInterval(timer);
        isGameActive = false;
        showModal("시간 초과", "다시 도전해보세요.", "재시작", () => {
            startGame(currentLevel);
        });
    }

    // 모달 표시 함수
    function showModal(title, msg, btnText, callback) {
        modalTitle.textContent = title;
        modalMsg.textContent = msg;
        modalBtn.textContent = btnText;
        modal.classList.remove('hidden');

        modalBtn.onclick = () => {
            modal.classList.add('hidden');
            callback();
        };
    }

    // 6. F2키 입력 처리
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2') {
            e.preventDefault(); // 브라우저 기본 동작 차단 (필요시)
            if (isGameActive) {
                const choice = confirm("현재 게임을 중지하고 새로 시작하시겠습니까?");
                if (choice) {
                    clearInterval(timer);
                    // 1레벨부터 다시 할지, 현재 레벨 리셋일지 결정 (여기선 1레벨 리셋으로 간주하거나 현재 레벨 리셋)
                    // 요구사항: "새 게임을 시작하게 해주세요" -> 보통 초기화를 의미
                    // 편의상 1레벨로 초기화하여 새로 시작
                    const fullReset = confirm("1레벨부터 초기화 하시겠습니까? (취소 시 현재 레벨 재시작)");
                    if(fullReset) {
                        saveProgress(1);
                        startGame(1);
                    } else {
                        startGame(currentLevel);
                    }
                }
            }
        }
    });

    // 초기 실행
    loadProgress();
    startGame(currentLevel);
});