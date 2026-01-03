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
    let maxTime = 0; // 타임 바 계산용 전체 시간
    let timeLeft = 0;
    let flippedCards = [];
    let matchedPairs = 0;
    let totalPairs = 0;
    let isGameActive = false;
    let isProcessing = false;
    let isMuted = false;
    let isPaused = false; // 일시 정지 상태

    // DOM 요소
    const boardEl = document.getElementById('game-board');
    const levelDisplay = document.getElementById('level-display');
    const timeDisplay = document.getElementById('timer-display');
    const timerBar = document.getElementById('timer-bar'); // 타임 바

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

    // 오디오 요소
    const audioBgm = document.getElementById('bgm');
    const sfxFlip = document.getElementById('sfx-flip');
    const sfxMatch = document.getElementById('sfx-match');
    const sfxClear = document.getElementById('sfx-clear');

    audioBgm.volume = 0.3;
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
            audioBgm.pause();
            muteBtn.textContent = '🔇';
        } else {
            if (isGameActive && !isPaused) audioBgm.play();
            muteBtn.textContent = '🔊';
        }
    }
    muteBtn.addEventListener('click', toggleMute);

    // === 3. 일시 정지 기능 ===
    function togglePause() {
        if (!isGameActive || isProcessing) return; // 게임 중이 아니면 무시

        if (isPaused) {
            // 게임 재개
            isPaused = false;
            pauseOverlay.classList.add('hidden');
            pauseBtn.textContent = '⏸';
            startTimer(); // 타이머 다시 시작
            if (!isMuted) audioBgm.play();
        } else {
            // 일시 정지
            isPaused = true;
            pauseOverlay.classList.remove('hidden');
            pauseBtn.textContent = '▶';
            clearInterval(timer); // 타이머 멈춤
            audioBgm.pause();
        }
    }

    pauseBtn.addEventListener('click', togglePause);
    resumeBtn.addEventListener('click', togglePause);

    // === 4. 게임 로직 ===
    function loadProgress() {
        const savedLevel = localStorage.getItem('memoryGameLevel');
        currentLevel = savedLevel ? parseInt(savedLevel, 10) : 1;
        if (currentLevel > maxLevel) currentLevel = 1;
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
        maxTime = config.time; // 최대 시간 저장
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

        modal.classList.add('hidden');
        startOverlay.classList.add('hidden');
        pauseOverlay.classList.add('hidden');
        isGameActive = true;

        startTimer();

        if (!isMuted) audioBgm.play().catch(e => {});
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
        // 일시 정지 중이면 클릭 무시
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
        // 타임 바 업데이트
        const percentage = (timeLeft / maxTime) * 100;
        timerBar.style.width = `${percentage}%`;
    }

    function startTimer() {
        if (timer) clearInterval(timer);
        timer = setInterval(() => {
            timeLeft--;
            updateTimeBar();

            // 5초 이하 경고 (빨간색)
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
        audioBgm.pause();
        playSound(sfxClear);

        if (currentLevel >= maxLevel) {
            showModal("축하합니다!", "모든 레벨을 클리어하셨습니다!", "처음으로", () => startGame(1));
        } else {
            showModal("성공!", `레벨 ${currentLevel} 클리어!`, "다음 레벨", () => startGame(currentLevel + 1));
        }
    }

    function gameOver() {
        clearInterval(timer);
        isGameActive = false;
        audioBgm.pause();
        // 타임 바 0으로 확실히 처리
        timerBar.style.width = '0%';

        showModal("시간 초과", "다시 도전해보세요.", "재시작", () => startGame(currentLevel));
    }

    function showModal(title, msg, btnText, callback) {
        modalTitle.textContent = title;
        modalMsg.textContent = msg;
        modalBtn.textContent = btnText;
        modal.classList.remove('hidden');
        modalBtn.onclick = () => callback();
    }

    // F2키 처리 (일시 정지 오버레이가 떠있어도 동작)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2') {
            e.preventDefault();
            if (isGameActive || isPaused || !modal.classList.contains('hidden')) {
                // F2 누르면 일시정지 로직 등으로 꼬이지 않게 타이머 해제 먼저 수행
                clearInterval(timer);
                const choice = confirm("게임을 중지하고 새로 시작하시겠습니까?");
                if (choice) {
                    const fullReset = confirm("1레벨부터 초기화 하시겠습니까? (취소 시 현재 레벨 재시작)");
                    if(fullReset) {
                        saveProgress(1);
                        startGame(1);
                    } else {
                        startGame(currentLevel);
                    }
                } else {
                    // 취소 시 게임이 진행 중이었고 일시정지 상태가 아니었다면 타이머 재개
                    if (isGameActive && !isPaused) startTimer();
                }
            }
        }
    });

    loadProgress();
    startBtn.addEventListener('click', () => startGame(currentLevel));
});