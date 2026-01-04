document.addEventListener('DOMContentLoaded', () => {
    // === 1. 자산 및 변수 설정 ===
    const suits = [
        { name: 'S', start: 2, end: 14 },
        { name: 'D', start: 2, end: 14 },
        { name: 'H', start: 2, end: 14 },
        { name: 'C', start: 2, end: 13 }
    ];

    const cardImages = [];
    suits.forEach(suit => {
        for (let i = suit.start; i <= suit.end; i++) {
            let rank = i;
            if (i === 11) rank = 'J'; else if (i === 12) rank = 'Q';
            else if (i === 13) rank = 'K'; else if (i === 14) rank = 'A';
            cardImages.push(`${suit.name}${rank}.png`);
        }
    });

    // 게임 상태 변수
    let currentLevel = 1;
    let maxLevel = 100;
    let timer = null;
    let maxTime = 0;
    let timeLeft = 0;
    let flippedCards = [];
    let matchedPairs = 0;
    let totalPairs = 0;
    let isGameActive = false;
    let isProcessing = false;
    let isMuted = false;
    let isPaused = false;

    // DOM 요소
    const boardEl = document.getElementById('game-board');
    const levelDisplay = document.getElementById('level-display');
    const timeDisplay = document.getElementById('timer-display');
    const timerBar = document.getElementById('timer-bar');

    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMsg = document.getElementById('modal-msg');
    const modalBtn = document.getElementById('modal-btn');

    const startOverlay = document.getElementById('start-overlay');
    const startBtn = document.getElementById('start-btn');

    const pauseOverlay = document.getElementById('pause-overlay');
    const pauseBtn = document.getElementById('pause-btn');
    const resumeBtn = document.getElementById('resume-btn');

    const muteBtn = document.getElementById('mute-btn');

    // "F2: 재시작" 버튼 요소를 찾습니다 (HTML에 ID가 없어도 텍스트로 찾음)
    // 만약 HTML에 id="restart-btn"을 주셨다면 getElementById로 바꾸셔도 됩니다.
    const allInfoBoxes = document.querySelectorAll('.info-box');
    let restartBtnEl = null;
    allInfoBoxes.forEach(box => {
        if (box.textContent.includes('F2') || box.textContent.includes('재시작')) {
            restartBtnEl = box;
            restartBtnEl.style.cursor = 'pointer'; // 마우스 올리면 손가락 모양
        }
    });

    // 오디오 요소 (요청하신 로직 유지)
    const sfxFlip = document.getElementById('sfx-flip');
    sfxFlip.src = "data:audio/mp3;base64," + flip_audio;
    const sfxMatch = document.getElementById('sfx-match');
    sfxMatch.src = "data:audio/mp3;base64," + match_audio;
    const sfxClear = document.getElementById('sfx-clear');
    sfxClear.src = "data:audio/mp3;base64," + clear_audio;

    // 볼륨 설정
    sfxFlip.volume = 0.5;
    sfxMatch.volume = 0.6;
    sfxClear.volume = 0.6;

    // === 2. 오디오 기능 ===
    function playSound(audioElement) {
        if (isMuted) return;
        audioElement.currentTime = 0;
        audioElement.play().catch(e => {});
    }

    function toggleMute() {
        isMuted = !isMuted;
        if (isMuted) {
            muteBtn.textContent = '🔇';
        } else {
            muteBtn.textContent = '🔊';
        }
    }
    muteBtn.addEventListener('click', toggleMute);

    // === 3. 일시 정지 기능 ===
    function togglePause() {
        if (!isGameActive || isProcessing) return;

        if (isPaused) {
            // 게임 재개
            isPaused = false;
            pauseOverlay.classList.add('hidden');
            pauseBtn.textContent = '⏸';
            startTimer();
        } else {
            // 일시 정지
            isPaused = true;
            pauseOverlay.classList.remove('hidden');
            pauseBtn.textContent = '▶';
            clearInterval(timer);
        }
    }

    pauseBtn.addEventListener('click', togglePause);
    resumeBtn.addEventListener('click', togglePause);

    // === 4. 게임 로직 ===
    function loadProgress() {
        const savedLevel = localStorage.getItem('memoryGameLevel');
        currentLevel = savedLevel ? parseInt(savedLevel, 10) : 1;
        if (currentLevel > maxLevel) currentLevel = 1;
        levelDisplay.textContent = currentLevel; // 로드 시 UI 업데이트
    }

    function saveProgress(level) {
        localStorage.setItem('memoryGameLevel', level);
    }

    function getLevelConfig(level) {
        let pairs = Math.min(2 + Math.floor((level - 1) / 2), 24);
        let baseTime = 10;
        let timePerPair = 5;
        let penalty = Math.floor(level / 5);
        let time = baseTime + (pairs * timePerPair) - penalty;
        if (time < 10) time = 10;

        let cols = 4;
        if (pairs >= 6) cols = 4;
        if (pairs >= 8) cols = 5;
        if (pairs >= 10) cols = 6;
        if (pairs >= 15) cols = 8;

        return { pairs, time, cols };
    }

    function startGame(level) {
        currentLevel = level;
        levelDisplay.textContent = currentLevel;
        saveProgress(currentLevel);

        const config = getLevelConfig(currentLevel);
        maxTime = config.time;
        timeLeft = config.time;
        totalPairs = config.pairs;
        matchedPairs = 0;
        flippedCards = [];
        isProcessing = false;
        isPaused = false;

        timeDisplay.textContent = timeLeft;

        // 타임 바 초기화
        timerBar.style.width = '100%';
        timerBar.classList.remove('warning');

        setupBoard(config);

        // UI 상태 업데이트
        modal.classList.add('hidden');
        startOverlay.classList.add('hidden');
        pauseOverlay.classList.add('hidden');

        isGameActive = true;

        // === 5. 카드 미리보기 로직 (12장 이상 시) ===
        const totalCards = config.pairs * 2;
        if (totalCards >= 8) {
            // 사용자 조작 방지
            isProcessing = true;
            let showTimer = 1200;
            if (totalCards >= 12) {
                showTimer = 2500;
            } else if (totalCards >= 24) {
                showTimer = 4000;
            } else if (totalCards >= 48) {
                showTimer = 8000;
            }

            // 모든 카드 뒤집기 (앞면 표시)
            const allCards = document.querySelectorAll('.card');
            allCards.forEach(card => card.classList.add('flipped'));

            // 3초 후 다시 뒤집고 타이머 시작
            setTimeout(() => {
                allCards.forEach(card => card.classList.remove('flipped'));
                isProcessing = false;
                startTimer(); // 미리보기가 끝난 후 타이머 시작
            }, 3000);
        } else {
            // 12장 이하면 바로 타이머 시작
            startTimer();
        }
    }

    function setupBoard(config) {
        boardEl.innerHTML = '';
        boardEl.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;

        let deck = [];
        let shuffledAssets = [...cardImages].sort(() => 0.5 - Math.random());
        let selectedAssets = shuffledAssets.slice(0, config.pairs);

        selectedAssets.forEach(asset => { deck.push(asset); deck.push(asset); });
        deck.sort(() => 0.5 - Math.random());

        deck.forEach((imgSrc, index) => {
            const card = document.createElement('div');
            card.classList.add('card');
            card.dataset.id = index;
            card.dataset.image = imgSrc;
            card.innerHTML = `
                <div class="card-inner">
                    <div class="card-front"><img src="assets/${imgSrc}" alt="card"></div>
                    <div class="card-back"><img src="assets/back.png" alt="back"></div>
                </div>
            `;
            card.addEventListener('click', () => flipCard(card));
            boardEl.appendChild(card);
        });
    }

    function flipCard(card) {
        if (!isGameActive || isProcessing || isPaused) return;
        if (card.classList.contains('flipped') || card.classList.contains('matched')) return;

        playSound(sfxFlip);

        card.classList.add('flipped');
        flippedCards.push(card);

        if (flippedCards.length === 2) {
            checkForMatch();
        }
    }

    function checkForMatch() {
        isProcessing = true;
        const [card1, card2] = flippedCards;

        if (card1.dataset.image === card2.dataset.image) {
            setTimeout(() => {
                playSound(sfxMatch);
                card1.classList.add('matched');
                card2.classList.add('matched');
                matchedPairs++;
                flippedCards = [];
                isProcessing = false;

                if (timeLeft < 10) {
                    timeLeft += 5;
                }
                if (timeLeft < 20) {
                    timeLeft += 5;
                    updateTimeBar();
                }

                if (matchedPairs === totalPairs) levelClear();
            }, 200);
        } else {
            setTimeout(() => {
                card1.classList.remove('flipped');
                card2.classList.remove('flipped');
                flippedCards = [];
                isProcessing = false;
            }, 800);
        }
    }

    function updateTimeBar() {
        timeDisplay.textContent = timeLeft;
        const percentage = (timeLeft / maxTime) * 100;
        timerBar.style.width = `${percentage}%`;
    }

    function startTimer() {
        if (timer) clearInterval(timer);
        timer = setInterval(() => {
            timeLeft--;
            updateTimeBar();

            if (timeLeft <= 5) {
                timerBar.classList.add('warning');
            }

            if (timeLeft <= 0) {
                gameOver();
            }
        }, 1000);
    }

    function levelClear() {
        clearInterval(timer);
        isGameActive = false;
        playSound(sfxClear);

        if (currentLevel >= maxLevel) {
            showModal("축하합니다!", "모든 레벨을 클리어하셨습니다!", "처음으로", () => {
                modal.classList.add('hidden');
                currentLevel = 1;
                saveProgress(currentLevel);
                levelDisplay.textContent = currentLevel;
                startOverlay.classList.remove('hidden');
            });
        } else {
            showModal("성공!", `레벨 ${currentLevel} 클리어!`, "다음 단계 준비", () => {
                modal.classList.add('hidden');
                currentLevel++;
                saveProgress(currentLevel);
                levelDisplay.textContent = currentLevel;
                startOverlay.classList.remove('hidden');
            });
        }
    }

    function gameOver() {
        clearInterval(timer);
        isGameActive = false;
        timerBar.style.width = '0%';

        showModal("시간 초과", "다시 도전해보세요.", "재시작", () => {
            modal.classList.add('hidden');
            startGame(currentLevel);
        });
    }

    function showModal(title, msg, btnText, callback) {
        modalTitle.textContent = title;
        modalMsg.textContent = msg;
        modalBtn.textContent = btnText;
        modal.classList.remove('hidden');
        modalBtn.onclick = () => callback();
    }

    // === 재시작 로직 통합 함수 (F2키 & 마우스 클릭 공용) ===
    function handleRestart() {
        if (isGameActive || isPaused || !modal.classList.contains('hidden')) {
            clearInterval(timer);
            const choice = confirm("게임을 중지하고 새로 시작하시겠습니까?");
            if (choice) {
                const fullReset = confirm("1레벨부터 초기화 하시겠습니까? (취소 시 현재 레벨 재시작)");
                if(fullReset) {
                    saveProgress(1);
                    currentLevel = 1;
                }
                levelDisplay.textContent = currentLevel;
                modal.classList.add('hidden');
                pauseOverlay.classList.add('hidden');
                startOverlay.classList.remove('hidden');
                isGameActive = false;
            } else {
                if (isGameActive && !isPaused) startTimer();
            }
        }
    }

    // F2 키 이벤트 연결
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2') {
            e.preventDefault();
            handleRestart();
        }
    });

    // 4. 재시작 버튼(텍스트) 클릭 이벤트 연결
    if (restartBtnEl) {
        restartBtnEl.addEventListener('click', handleRestart);
    }

    // 초기 실행 로직
    loadProgress();
    startBtn.addEventListener('click', () => {
        startGame(currentLevel);
    });
});