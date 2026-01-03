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
            if (i === 11) rank = 'J';
            else if (i === 12) rank = 'Q';
            else if (i === 13) rank = 'K';
            else if (i === 14) rank = 'A';
            cardImages.push(`${suit.name}${rank}.png`);
        }
    });

    // 게임 상태 변수
    let currentLevel = 1;
    let maxLevel = 100;
    let timer = null;
    let timeLeft = 0;
    let cards = [];
    let flippedCards = [];
    let matchedPairs = 0;
    let totalPairs = 0;
    let isGameActive = false;
    let isProcessing = false;
    let isMuted = false;

    // DOM 요소
    const boardEl = document.getElementById('game-board');
    const levelDisplay = document.getElementById('level-display');
    const timeDisplay = document.getElementById('timer-display');
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMsg = document.getElementById('modal-msg');
    const modalBtn = document.getElementById('modal-btn');
    const startOverlay = document.getElementById('start-overlay');
    const startBtn = document.getElementById('start-btn');
    const muteBtn = document.getElementById('mute-btn');

    // 오디오 요소
    const audioBgm = document.getElementById('bgm');
    const sfxFlip = document.getElementById('sfx-flip');
    const sfxMatch = document.getElementById('sfx-match');
    const sfxClear = document.getElementById('sfx-clear');

    // 오디오 볼륨 설정
    audioBgm.volume = 0.3; // 배경음악은 약간 작게
    sfxFlip.volume = 0.5;
    sfxMatch.volume = 0.6;
    sfxClear.volume = 0.6;

    // === 2. 오디오 기능 ===
    function playSound(audioElement) {
        if (isMuted) return;
        // 연속 재생을 위해 재생 위치를 0으로 초기화
        audioElement.currentTime = 0;
        audioElement.play().catch(e => console.log('Audio play error:', e));
    }

    function toggleMute() {
        isMuted = !isMuted;
        if (isMuted) {
            audioBgm.pause();
            muteBtn.textContent = '🔇';
        } else {
            if (isGameActive) audioBgm.play();
            muteBtn.textContent = '🔊';
        }
    }

    muteBtn.addEventListener('click', toggleMute);

    // === 3. 게임 로직 ===

    function loadProgress() {
        const savedLevel = localStorage.getItem('memoryGameLevel');
        if (savedLevel) {
            currentLevel = parseInt(savedLevel, 10);
            if (currentLevel > maxLevel) currentLevel = 1;
        } else {
            currentLevel = 1;
        }
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

    // 게임 시작 (초기화)
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

        // UI 및 오디오 처리
        modal.classList.add('hidden');
        startOverlay.classList.add('hidden');
        isGameActive = true;

        startTimer();

        if (!isMuted) {
            audioBgm.play().catch(e => console.log('BGM Autoplay prevented'));
        }
    }

    function setupBoard(config) {
        boardEl.innerHTML = '';
        boardEl.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;

        let deck = [];
        let shuffledAssets = [...cardImages].sort(() => 0.5 - Math.random());
        let selectedAssets = shuffledAssets.slice(0, config.pairs);

        selectedAssets.forEach(asset => {
            deck.push(asset);
            deck.push(asset);
        });

        deck.sort(() => 0.5 - Math.random());

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

            card.addEventListener('click', () => flipCard(card));
            boardEl.appendChild(card);
        });
    }

    function flipCard(card) {
        // 첫 클릭 버그 수정: 게임 활성화 상태 확인 및 처리 중복 방지 강화
        if (!isGameActive || isProcessing) return;
        if (card.classList.contains('flipped') || card.classList.contains('matched')) return;

        // 효과음 재생
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
            // 매칭 성공
            // 약간의 딜레이 후 효과음과 처리를 하여 자연스럽게
            setTimeout(() => {
                playSound(sfxMatch);
                card1.classList.add('matched');
                card2.classList.add('matched');
                matchedPairs++;
                flippedCards = [];
                isProcessing = false;

                if (matchedPairs === totalPairs) {
                    levelClear();
                }
            }, 200);
        } else {
            // 매칭 실패
            setTimeout(() => {
                card1.classList.remove('flipped');
                card2.classList.remove('flipped');
                flippedCards = [];
                isProcessing = false;
            }, 800);
        }
    }

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

    function levelClear() {
        clearInterval(timer);
        isGameActive = false;
        audioBgm.pause();
        playSound(sfxClear); // 클리어 효과음

        if (currentLevel >= maxLevel) {
            showModal("축하합니다!", "모든 레벨을 클리어하셨습니다!", "처음으로", () => startGame(1));
        } else {
            showModal("성공!", `레벨 ${currentLevel} 클리어!`, "다음 레벨", () => {
                startGame(currentLevel + 1);
            });
        }
    }

    function gameOver() {
        clearInterval(timer);
        isGameActive = false;
        audioBgm.pause();
        showModal("시간 초과", "다시 도전해보세요.", "재시작", () => {
            startGame(currentLevel);
        });
    }

    function showModal(title, msg, btnText, callback) {
        modalTitle.textContent = title;
        modalMsg.textContent = msg;
        modalBtn.textContent = btnText;
        modal.classList.remove('hidden');

        modalBtn.onclick = () => {
            callback();
        };
    }

    // F2키 처리
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2') {
            e.preventDefault();
            if (isGameActive || !modal.classList.contains('hidden')) {
                const choice = confirm("게임을 중지하고 새로 시작하시겠습니까?");
                if (choice) {
                    clearInterval(timer);
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

    // === 초기 실행 흐름 수정 (첫 클릭 버그 해결) ===
    loadProgress();

    // 바로 startGame을 하지 않고, "게임 시작" 버튼 이벤트를 기다림
    startBtn.addEventListener('click', () => {
        // 브라우저 오디오 권한 획득을 위해 빈 오디오 재생 시도 등은 필요 없으나,
        // 사용자 인터랙션 후 BGM 재생은 안전함.
        startGame(currentLevel);
    });
});